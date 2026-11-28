// ===================================================================
// The chapter's boss (story series, round 10): Principal Somsak, DISCIPLINE
// -------------------------------------------------------------------
// The design's 1-7: the flag yard at sunset, the stage and its podium, the painted lines the school
// lines up on, the covered walkways' posts to hide behind, the gate far off. He took the biggest dose
// of LEXA to give his speech in perfect English; one word is left, DISCIPLINE, and a shield of its
// family round him. He is one of the field's zombies (js/entities.js: half as big again as a Shambler,
// slow, a blow for whoever stands too near), but no round gets through the shield:
//   the shield   three layers. Its question is the glasses' -- a sentence with a gap ("The school has
//                strict ___ rules.") under his bar -- and its answers float before him on three plates,
//                the word's forms (discipline / disciplinary / disciplined): the plate shot is the
//                answer. Right: a layer breaks. Wrong: a layer grows back, and the card says why. The
//                first time the design's three sentences in order; after that shuffled, with the
//                chapter's words the player has got wrong this play-through among them (their own
//                forms: js/clues.js). A word of the bank counts in its memory box (a recall answer).
//   open         the three broken: he goes down on his knees, his three patches lit -- `openSec` to
//                shoot them (the head: the patches; anywhere else a little); then the shield again
//   his moves    each with its sign first; between two he walks at the player as any zombie does
//     lineup     the whistle, long: "LINE UP!" -- students come out and walk to the painted lines
//                (they wait there, facing the stage: js/game.js asks lineStep), then come at the
//                player two at a time. Their words are any group's (the questions asked as ever): one
//                shot before the line is complete is one fewer in the wave
//     podium     the podium lifted, a red circle where the player stands, `podWarn` later it lands
//     megaphone  a breath, the megaphone lit: a cone of sound -- in it, and nothing solid between
//                (the walkways' posts), the player is thrown back and every word label's letters
//                swap places for `scrambleSec` (Settings > Accessibility can turn that off)
//   phases       below half his health the megaphone too, the lines quicker, "DIS--CI--PLINE!";
//                below a quarter two Screamers from the entrance hall and everything faster. Each
//                begins with a save (the design's: mid-fight) -- the flag "<id>:p2" / ":p3": the fight
//                picked up there starts in that phase. A window never takes him past a phase's line.
//   down         he kneels; the megaphone falls and plays his recorded speech; he lies down. Quiet --
//                no blood, whatever the settings. The flag "boss:<id>"
// A variant of the campaign's headmaster (decision D4: js/bosses.js -- the whistle, the assembly):
// his marks on the ground and chips (G.BossFX), his sounds (G.Audio.boss), the bar (G.UI.setBossBar)
// -- not the campaign's arena, cutscene or health.
//   ["principal", { id, who, name, word, gloss, at, yaw, items, forms, moves, from, spots, face, hall, cp, drops }]
//     (forms: { form: part of speech } for the cards, where the bank's family is short of one)
//   G.StoryPrincipal.start(game, run, o) / update(game, dt) / reset(game) / warm(game) / info()
//   G.StoryPrincipal.onShot(game, origin, dir, far)  js/game.js raycastShoot: a plate took the round -> true
//   G.StoryPrincipal.onHit(game, z, dmg, at, info)   js/game.js damageZombie: one of his -> true
//   G.StoryPrincipal.onDeath(game, z)                js/game.js startDeathAnimation
//   G.StoryPrincipal.lineStep(game, z, dt, me)       js/game.js updateZombies: a student lining up -> true
//   G.StoryPrincipal.line() / label()                the word box while nothing else is asked
// Every number is G.CONFIG.story.principal.
// ===================================================================
window.G = window.G || {};

G.StoryPrincipal = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.principal) || {};
  const PX = () => (G.CONFIG.story && G.CONFIG.story.voxel && G.CONFIG.story.voxel.px) || 0.05625;
  const run = () => G.Story && G.Story.run;
  const num = (v, d) => (v != null ? v : d);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const A = () => (G.Audio && G.Audio.ctx && G.Audio.group ? G.Audio : null);
  const ph = (list, p) => { const a = [].concat(list); return a[Math.min(a.length - 1, Math.max(0, p - 1))]; };
  let B = null, body = null, plates = null, shieldEl = null;

  // ---------------- sounds ----------------
  const VOICE = { f: 64, rough: 10, len: 1.8 };
  const boss = (name) => { if (B && G.Audio && G.Audio.boss) G.Audio.boss(name, { pos: B.z.mesh.position.clone().setY(B.z.mesh.position.y + 2), voice: VOICE }); };
  const sfx = (name, pos) => { if (G.Audio && G.Audio.sfx) G.Audio.sfx(name, { pos }); };
  // his whistle, long (the campaign's is short): three blasts run together
  function whistle(pos) {
    const a = A();
    if (!a) return;
    a.group({ cat: "sfx", prio: 1, pos, dur: 1.4 }, () => {
      [0, 0.42, 0.84].forEach((at, i) => {
        a.tone({ type: "square", freq: 2900 - i * 40, dur: i === 2 ? 0.7 : 0.4, gain: 0.11, at, vibrato: { rate: 32, depth: 160 }, filter: { type: "bandpass", freq: 3000, q: 3 }, pos });
        a.tone({ type: "sine", freq: 2950 - i * 40, dur: i === 2 ? 0.7 : 0.4, gain: 0.08, at, vibrato: { rate: 30, depth: 170 }, pos });
      });
    });
  }
  // the megaphone's feedback: a squeal and a crackle
  function squeal(pos, k) {
    const a = A();
    if (!a) return;
    a.group({ cat: "sfx", prio: 1, pos, dur: 0.9 }, () => {
      a.tone({ type: "sine", freq: 2200, freqEnd: 3400, dur: 0.6 * (k || 1), gain: 0.05, pos });
      a.noise({ dur: 0.5, filter: "bandpass", freq: 1800, q: 1.4, gain: 0.12, attack: 0.05, pos });
    });
  }
  function blast(pos) {
    const a = A();
    if (!a) return;
    a.group({ cat: "sfx", prio: 3, pos, dur: 1.2 }, () => {
      a.tone({ type: "sawtooth", freq: 140, freqEnd: 70, dur: 0.9, gain: 0.32, vibrato: { rate: 14, depth: 18 }, filter: { type: "bandpass", freq: 900, q: 1.2 }, pos });
      a.noise({ dur: 0.8, filter: "bandpass", freq: 1200, freqEnd: 400, q: 0.8, gain: 0.5, pos });
      a.tone({ type: "square", freq: 1600, freqEnd: 900, dur: 0.5, gain: 0.04, pos });
    });
    if (G.Audio.boss) G.Audio.boss("hurt", { pos, voice: VOICE });
  }

  // ---------------- the marks on the ground (js/bosses.js G.BossFX) ----------------
  function fx(game) {
    const F = G.BossFX;
    if (!F || !game.scene) return null;
    if (F.scene !== game.scene || !F.debris) {
      F.init(game.scene, B ? B.z.mesh.position.y : 0);
      [F.papers, F.spikes].forEach((m) => { if (m) m.visible = false; });
    }
    [F.debris, F.motes].forEach((m) => { if (m) m.visible = true; });
    return F;
  }
  // (as the scene begins, under its black: the marks', chips', plates' and rings' shaders made then)
  function warm(game) {
    const F = fx(game);
    if (!F) return;
    const a = F.decal({ mode: "disc", x: 0, z: 0, y: -60, r: 1 }), b = F.decal({ mode: "sector", x: 0, z: 0, y: -60, r: 2, half: 0.5 }), c = F.decal({ mode: "ring", x: 0, z: 0, y: -60, r: 1, w: 0.4, add: true });
    const tmp = makePlates(game), rr = makeRings();
    tmp.list.forEach((p) => { p.pos.set(0, -60, 0); p.visible = true; }); quads(tmp); game.scene.add(tmp.mesh);
    rr.g.position.set(0, -60, 0); game.scene.add(rr.g);
    try { if (game.renderer && game.renderer.compile && game.camera) game.renderer.compile(game.scene, game.camera); } catch (e) { /* (made when first drawn, then) */ }
    a.hide(); b.hide(); c.hide();
    away(tmp.mesh); tmp.mesh.material.dispose(); away(rr.g); rr.geos.forEach((q) => { if (q) q.dispose(); });
    [F.debris, F.motes].forEach((m) => { if (m) m.visible = false; });
  }

  // ---------------- what he carries ----------------
  // boxes of the block atlas as one mesh: [faces, x0, y0, z0, x1, y1, z1]
  function boxes(list) {
    const V = G.Voxel, buf = new V.Buf(false);
    list.forEach((b) => V.addBox(buf, b[1], b[2], b[3], b[4], b[5], b[6], V.faceTiles(b[0]), {}));
    const m = new THREE.Mesh(buf.geometry(), V.mat("prop"));
    m.castShadow = true;
    return m;
  }
  // the lanyard (NeuroLex blue) and the whistle on it, the school's pin: on his chest
  function dress(z) {
    const u = z.mesh.userData, P = PX();
    if (!u.upper) return;
    // (one mesh -- the lanyard's strap, the whistle on it, the pin)
    u.upper.add(boxes([["paintBlue", -2.4 * P, 7 * P, 2.05 * P, -1.8 * P, 12 * P, 2.25 * P], ["paintBlue", 1.8 * P, 7 * P, 2.05 * P, 2.4 * P, 12 * P, 2.25 * P], ["paintBlue", -2.4 * P, 6.4 * P, 2.05 * P, 2.4 * P, 7 * P, 2.25 * P],
      ["metal", -0.7 * P, 4.6 * P, 2.1 * P, 0.7 * P, 6.4 * P, 3.2 * P], ["metalDark", -0.3 * P, 6.4 * P, 2.4 * P, 0.3 * P, 6.8 * P, 2.9 * P], ["paintYellow", 2.6 * P, 9.6 * P, 2.05 * P, 3.4 * P, 10.4 * P, 2.2 * P]]));
    // the megaphone in his left hand
    const L = u.limbs;
    if (L && L.armL && G.VoxelProps) {
      const m = G.VoxelProps.build("megaphone", {});
      m.scale.setScalar(1.05);
      m.position.set(0, -10.5 * P, 0.1);
      m.rotation.set(-Math.PI / 2, 0, 0);
      L.armL.shoulder.add(m);
      B.mega = m;
      // (its bell lit for the cone: an additive box over it)
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.12), new THREE.MeshBasicMaterial({ color: 0x9ae8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(0, 0.02, 0.36);
      glow.visible = false;                              // (drawn only while it is lit)
      m.add(glow);
      B.megaGlow = glow;
    }
    // the patches' mark (shown while the shield is down): a pulse over the three on his nape
    if (u.neck) {
      // (drawn over him -- seen from in front through his head: where to shoot)
      const mk = new THREE.Mesh(new THREE.BoxGeometry(8 * P, 3.4 * P, 1.2 * P), new THREE.MeshBasicMaterial({ color: 0x5ae0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      mk.renderOrder = 9;
      mk.position.set(0, 1 * P, -4.5 * P);
      mk.visible = false;
      u.neck.add(mk);
      B.mark = mk;
    }
  }

  // ---------------- the shield: its rings ----------------
  // a ring of small blocks for each layer left -- one mesh (one draw call): its geometry swapped for one with as many
  // rings as there are layers
  function makeRings() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = (i) => {
      const out = [], n = 12, r = 1.05 + i * 0.22, a0 = i * 0.26;
      for (let k = 0; k < n; k++) {
        const b = new THREE.BoxGeometry(0.2, 0.08, 0.08), a = a0 + (k / n) * Math.PI * 2;
        b.rotateY(-a); b.translate(Math.cos(a) * r, 0.8 + i * 0.55, Math.sin(a) * r);
        out.push(b);
      }
      return out;
    };
    const geos = [null, mergeBoxes(ring(0)), mergeBoxes(ring(0).concat(ring(1))), mergeBoxes(ring(0).concat(ring(1), ring(2)))];
    const m = new THREE.Mesh(geos[3], mat);
    m.frustumCulled = false;
    g.add(m);
    return { g, m, geos, mat, n: 3 };
  }
  // (three.js r128 has no merge helper in its core: positions and indices into one geometry)
  function mergeBoxes(list) {
    const pos = [], idx = [];
    let off = 0;
    list.forEach((b) => {
      const p = b.attributes.position.array, ix = b.index.array;
      for (let i = 0; i < p.length; i++) pos.push(p[i]);
      for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off);
      off += p.length / 3;
      b.dispose();
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  // ---------------- the shield: its plates ----------------
  // the three plates are one mesh -- three quads, one canvas of three rows (one draw call: in the yard with a line of
  // students and the whole school in view every call counts); each plate's place and turn kept on its own entry
  const ROW = 128;
  function makePlates(game) {
    const cv = document.createElement("canvas");
    cv.width = 512; cv.height = ROW * 3;
    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(3 * 4 * 3), uv = new Float32Array(3 * 4 * 2), idx = [];
    for (let i = 0; i < 3; i++) {
      const v0 = 1 - (i + 1) / 3, v1 = 1 - i / 3;           // (row i of the canvas, from the top)
      uv.set([0, v0, 1, v0, 1, v1, 0, v1], i * 8);
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 7;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    const list = [0, 1, 2].map((k) => ({ k, word: "", state: "", pos: new THREE.Vector3(), yaw: 0, visible: false }));
    return { mesh, cv, tex, list };
  }
  function drawPlate(set, i, word, state) {
    const p = set.list[i];
    if (p.word === word && p.state === state) return;
    p.word = word; p.state = state;
    const c = set.cv.getContext("2d"), W = set.cv.width, H = ROW, y0 = i * ROW;
    const col = { idle: ["rgba(14,40,64,0.9)", "#5fd8ff", "#ffffff"], hot: ["rgba(40,58,20,0.92)", "#ffe36b", "#fff6c8"], right: ["rgba(20,70,36,0.92)", "#7dffa8", "#e8ffef"],
      wrong: ["rgba(80,18,24,0.92)", "#ff7a8a", "#ffe0e4"], dim: ["rgba(20,24,30,0.75)", "#5a6470", "#9aa4ae"] }[state] || ["rgba(14,40,64,0.9)", "#5fd8ff", "#ffffff"];
    c.clearRect(0, y0, W, H);
    c.fillStyle = col[0]; c.fillRect(6, y0 + 6, W - 12, H - 12);
    // a frame of pixels, block-style: thick edges, notched corners
    c.fillStyle = col[1];
    c.fillRect(14, y0, W - 28, 8); c.fillRect(14, y0 + H - 8, W - 28, 8); c.fillRect(0, y0 + 14, 8, H - 28); c.fillRect(W - 8, y0 + 14, 8, H - 28);
    c.fillRect(6, y0 + 6, 10, 10); c.fillRect(W - 16, y0 + 6, 10, 10); c.fillRect(6, y0 + H - 16, 10, 10); c.fillRect(W - 16, y0 + H - 16, 10, 10);
    let size = 64;
    c.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
    while (c.measureText(word).width > W - 60 && size > 28) { size -= 4; c.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`; }
    c.fillStyle = col[2]; c.textAlign = "center"; c.textBaseline = "middle";
    c.shadowColor = "rgba(0,0,0,0.6)"; c.shadowBlur = 6;
    c.fillText(word, W / 2, y0 + H / 2 + 3);
    c.shadowBlur = 0;
    set.tex.needsUpdate = true;
  }
  // a plate's quad where its entry says (turned to its yaw); a hidden one folded to nothing
  function quads(set) {
    const a = set.mesh.geometry.attributes.position, W = (C().plateW || 1.5) / 2, H = (C().plateH || 0.42) / 2;
    set.list.forEach((p, i) => {
      const o = i * 12, rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw), w = p.visible ? W : 0, h = p.visible ? H : 0, c = p.pos;
      a.array.set([c.x - rx * w, c.y - h, c.z - rz * w, c.x + rx * w, c.y - h, c.z + rz * w, c.x + rx * w, c.y + h, c.z + rz * w, c.x - rx * w, c.y + h, c.z - rz * w], o);
    });
    a.needsUpdate = true;
    set.mesh.geometry.computeBoundingSphere();
  }
  // where they float: side by side before him, toward the player, at about the height of his chest (above his
  // head when the player is right up against him) -- in a row across the player's view, never one over another --
  // each turned to face the camera
  function placePlates(game, dt) {
    if (!plates || !B) return;
    const z = B.z, p = z.mesh.position, cam = game.yawObject.position;
    const show = plates.on && B.q && !B.scrambleHide;
    const dx = cam.x - p.x, dz = cam.z - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const close = d < (C().plateClose || 2.8);
    const R = Math.min(C().plateR || 1.6, d * 0.5), gap = (C().plateW || 1.5) + (C().plateGap || 0.2);
    const cx = p.x + ux * R, cz = p.z + uz * R, rx = uz, rz = -ux;          // (the row's middle; across the view)
    B.bob = (B.bob || 0) + dt;
    plates.mesh.visible = !!show;
    plates.list.forEach((pl, i) => {
      pl.visible = !!show;
      if (!show) return;
      const y = p.y + (close ? (z.mesh.userData.top || 1.8) * z.mesh.scale.y + 0.45 : C().plateY || 2.35) + Math.sin(B.bob * 1.6 + i * 2.1) * 0.06;
      pl.pos.set(cx + rx * (i - 1) * gap, y, cz + rz * (i - 1) * gap);
      pl.yaw = Math.atan2(cam.x - pl.pos.x, cam.z - pl.pos.z);
    });
    if (show) quads(plates);
  }
  // the plate a ray meets first (its plane, the word's rectangle): { i, d } or null
  function plateOnRay(origin, dir, far) {
    if (!plates || !plates.on || !B || !B.q) return null;
    const W = (C().plateW || 1.5) / 2 + 0.04, H = (C().plateH || 0.42) / 2 + 0.04;
    let best = null;
    plates.list.forEach((pl, i) => {
      if (!pl.visible) return;
      const yaw = pl.yaw, nx = Math.sin(yaw), nz = Math.cos(yaw), m = pl.pos;
      const den = dir.x * nx + dir.z * nz;
      if (Math.abs(den) < 1e-4) return;
      const t = ((m.x - origin.x) * nx + (m.z - origin.z) * nz) / den;
      if (t <= 0 || t > far) return;
      const hx = origin.x + dir.x * t - m.x, hy = origin.y + dir.y * t - m.y, hz = origin.z + dir.z * t - m.z;
      const u = hx * Math.cos(yaw) - hz * Math.sin(yaw);
      if (Math.abs(u) <= W && Math.abs(hy) <= H && (!best || t < best.d)) best = { i, d: t };
    });
    return best;
  }

  // ---------------- the questions ----------------
  // the design's sentences: { sentence (a key: English only -- translated it would give it away), options, answer,
  // why (a key: the reason, in the player's language) } -- the word (`o.word`) theirs
  function designItems() {
    return (B.o.items || []).map((it) => ({ sentence: G.STRINGS.en[it.cloze] != null ? G.STRINGS.en[it.cloze] : T(it.cloze), options: it.options.slice(), answer: it.answer, why: it.why || null, pair: B.pair, form: it.answer, design: true }));
  }
  // a chapter word got wrong this play-through, as a sentence of the bank's with a gap and its family's forms
  function missedItems(n) {
    const r = run(), out = [];
    if (!r || !G.Story.missedPairs || !G.Clues) return out;
    G.Story.missedPairs(r).forEach((pair) => {
      if (out.length >= n || G.wordKey(pair) === G.wordKey(B.pair)) return;
      if (!G.Clues.has(pair, "cloze")) return;
      const c = G.Clues.cloze(pair);
      if (!c || !c.answer) return;
      const fam = (G.Clues.familyDecoys(pair, c.answer) || []).map((f) => f.word).filter((w) => w && w.toLowerCase() !== c.answer.toLowerCase());
      if (fam.length < 2) return;
      const start = !c.before.trim(), shape = (w) => (start ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase());
      out.push({ sentence: c.before + "___" + c.after, options: [shape(c.answer), shape(fam[0]), shape(fam[1])], answer: shape(c.answer), pair, form: c.answer, cloze: c });
    });
    return out;
  }
  function buildQueue() {
    const d = designItems();
    if (!B.cycle) return d;
    const q = G.shuffle(d), extra = G.shuffle(missedItems(C().missed || 2));
    if (extra[0]) q.splice(1, 0, extra[0]);
    if (extra[1]) q.splice(3, 0, extra[1]);
    return q;
  }
  function ask(game) {
    if (!B.queue || !B.queue.length) B.queue = buildQueue();
    const it = B.queue.shift();
    if (!it) { B.q = null; return; }
    // (the plates' order its own each time)
    const order = G.shuffle(it.options.slice());
    B.q = Object.assign({}, it, { shown: order, k: order.indexOf(it.answer) });
    B.qN = (B.qN || 0) + 1;
    B.qLock = C().qSettle || 0.35;
    plates.on = true;
    order.forEach((w, i) => drawPlate(plates, i, w, "idle"));
    shieldLine();
    if (G.Audio && G.Audio.ctx && G.Audio.group) G.Audio.group({ cat: "ui", prio: 1, pos: null, dur: 0.4 }, () => G.Audio.tone({ type: "sine", freq: 660, freqEnd: 990, dur: 0.12, gain: 0.03 }));
  }
  // the plate shot: the answer
  function answer(game, i) {
    const q = B.q;
    if (!q || B.qLock > 0) return;
    const picked = q.shown[i], right = i === q.k;
    B.qLock = right ? (C().nextRight || 0.9) : (C().nextWrong || 1.8);
    B.wait = B.qLock;
    // a word of the bank: its box -- the form had to be found from the sentence (a recall answer)
    if (q.pair && G.WordBank && G.WordBank.byId && (G.WordBank.byId(q.pair.id || q.pair[0]) || G.WordBank.lookup(q.pair[0])) && G.Learning) {
      try { G.Learning.answerWord(q.pair, right, { recall: true, skills: ["context"], form: q.form }); } catch (e) { /* (an answer never fails on its bookkeeping) */ }
    }
    if (right) { if (game.correctCount != null) game.correctCount++; } else if (game.wrongCount != null) game.wrongCount++;
    q.shown.forEach((w, k) => drawPlate(plates, k, w, k === q.k ? "right" : k === i ? "wrong" : "dim"));
    explain(game, q, picked, right);
    // (a plate shot: the scene's line on how has done its job -- and on a touch screen it sits over the card's start)
    const H = G.StoryScreen;
    if (H && H.state.hint && H.state.hint === T("story.hint.shield")) H.setHint(null);
    const r = run(), F = fx(game), p = B.z.mesh.position;
    if (right) {
      B.shield = Math.max(0, B.shield - 1);
      B.rights++;
      game.player.combo = (game.player.combo || 0) + 1;
      if (G.Audio) G.Audio.sfx("correct");
      if (G.LexiLens) G.LexiLens.onCorrect();
      if (G.Audio && G.Audio.boss) G.Audio.boss("stone_break", { pos: p.clone().setY(p.y + 1.5) });
      if (F) F.sparks(p.x, p.y + 1.2 + B.shield * 0.55, p.z, 26, 0x5ad8ff, 4.5);
      if ((G.save.settings.speechMode || "after") === "after" && G.Audio && G.Audio.speak) G.Audio.speak(String(q.answer).toLowerCase());
    } else {
      const was = B.shield;
      B.shield = Math.min(C().shield || 3, B.shield + 1);
      B.misses++;
      if (r) r.flags.add(B.o.id + ":miss");                  // (round 11's Word Family: the shield broken every time with no wrong answer)
      game.player.combo = 0;
      if (G.Audio) G.Audio.sfx("wrong");
      if (was < B.shield && F) F.sparks(p.x, p.y + 0.8 + (B.shield - 1) * 0.55, p.z, 16, 0x5ad8ff, 2.5);
      // the one missed comes round again later
      B.queue.splice(Math.min(B.queue.length, 2), 0, Object.assign({}, q));
    }
    B.log.push((right ? "+" : "-") + String(q.answer).toLowerCase());
    if (B.log.length > 60) B.log.shift();
    shieldLine();
    bar(true);
  }
  // the card: why that form (the design's sentences have their reasons; the bank's, the game's explanation)
  function ownGloss(s) {
    if (!s || !s.form || !G.StoryQuiz) return;
    const r = run(), g = r && r.ch && r.ch.practice && r.ch.practice[String(s.word || "").toLowerCase()];
    const m = g ? G.StoryQuiz.glossOf(g) : "";
    if (!m) return;
    const ml = G.Lang && G.Lang.meaning ? G.Lang.meaning() : "th";
    s.meaning = m;
    s.mhtml = G.escapeHtml ? G.escapeHtml(m) : String(m).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    s.mattr = G.Lang && G.Lang.attr ? G.Lang.attr(g[ml] ? ml : g.en ? "en" : "th") : "";
  }
  function explain(game, q, picked, right) {
    if (!G.Explain || !G.ExplainCard) return;
    try {
      const wrongForm = right ? null : String(picked);
      const ex = right ? G.Explain.build({ pair: q.pair, form: q.form, type: "cloze", right: true, cloze: q.cloze })
        : G.Explain.answer({ pair: q.pair, form: q.form, type: "cloze", right: false, pickedForm: wrongForm, cloze: q.cloze });
      if (ex && q.why) { ex.why = T(q.why); ex.note = true; }
      // (a form the bank's family does not list -- "disciplined" -- has the headword's part of speech there: the scene's own)
      const F = (q.design && B.o.forms) || {}, pos = (s) => s && F[String(s.word || "").toLowerCase()];
      if (ex && pos(ex.y)) { ex.y.pos = pos(ex.y); ex.y.abbr = G.POS.abbr(ex.y.pos); }
      if (ex && pos(ex.x)) { ex.x.pos = pos(ex.x); ex.x.abbr = G.POS.abbr(ex.x.pos); }
      // (and the bank's meaning of a form is its headword's -- "disciplined = discipline's meaning" twice on the card:
      // the chapter's own gloss of that form, when it has one, in the player's meaning language)
      if (ex) [ex.x, ex.y].forEach(ownGloss);
      if (ex) G.ExplainCard.show(ex);
      // (the design's reason for that form, under his bar -- the card in the field is a line of meanings)
      if (q.why && G.UI && G.UI.setBossHint) G.UI.setBossHint(T(q.why), right ? 3 : 5.5);
      else if (!right && ex && ex.why && G.UI && G.UI.setBossHint) G.UI.setBossHint(ex.why, 5.5);
    } catch (e) { /* (a card is a nicety) */ }
  }
  // the line under his bar: the layers left and the sentence
  function shieldLine() {
    const bar = document.getElementById("hud-boss-bar");
    if (!bar) return;
    if (!shieldEl || !shieldEl.isConnected) {
      shieldEl = document.createElement("div");
      shieldEl.className = "story-shield";
      shieldEl.id = "story-shield";
      const hint = document.getElementById("hud-boss-hint");
      bar.insertBefore(shieldEl, hint || null);
    }
    const on = !!(B && B.q && plates && plates.on && B.st !== "open" && B.st !== "phase" && B.st !== "down");
    shieldEl.classList.toggle("hidden", !on);
    // (the plates sit over the crosshair: a touch screen's scene hint, mid-screen there, steps aside -- style.css)
    document.body.classList.toggle("story-plates-on", on);
    if (!on) return;
    const n = C().shield || 3, pips = Array.from({ length: n }, (_, i) => `<i class="${i < B.shield ? "on" : ""}"></i>`).join("");
    const s = G.escapeHtml(B.q.sentence).replace("___", '<span class="ss-gap">____</span>');
    const html = `<span class="ss-pips" aria-label="${G.escapeHtml(T("story.boss2.layers", { n: B.shield }))}">${pips}</span><span class="ss-q" lang="en">${s}</span>`;
    if (shieldEl.innerHTML !== html) shieldEl.innerHTML = html;
  }

  // ---------------- the fight begins ----------------
  function start(game, r, o) {
    reset(game);
    if (!o || !o.id || !r || !game.scene) return null;
    const flags = r.flags, phase = flags.has(o.id + ":p3") ? 3 : flags.has(o.id + ":p2") ? 2 : 1;
    const p = o.at || {}, pos = new THREE.Vector3(p.x || 0, Number.isFinite(p.y) ? p.y : 0, p.z || 0);
    const pair = G.WordBank && G.WordBank.byId(o.word) ? G.WordBank.pairOf(G.WordBank.byId(o.word)) : [o.word, (G.StoryQuiz ? G.StoryQuiz.glossOf(o.gloss) : "") || o.word];
    const z = game.spawnZombieAt("normal", pos, null, { pair: [pair[0], pair[1]], practice: true, noTarget: true, look: G.VoxelChars && G.VoxelChars.on() ? G.VoxelChars.zombieLook("normal", game, o.who || o.id) : null });
    if (!z) return null;
    z.storyBoss = o.id; z.storyGroup = o.id; z.principal = true;
    z.speed = phase >= 3 ? C().speedP3 || 1.45 : C().speed || 1.15;
    z.damage = C().bite || 40;
    z.hp = z.maxHp = 1e6;                              // (only the shield's way takes him down: onHit)
    const k = C().scale || 1.5;
    z.mesh.scale.multiplyScalar(k);
    // (no label over him in the fight: his word is the shield's -- its line, its plates; over him it read as a fourth
    // answer, and its part of speech gave one of them away)
    z.labelText = ""; z._label = null; z.setTarget(false);
    if (z.sprite) z.sprite.visible = false;
    if (Number.isFinite(o.yaw)) z.mesh.rotation.y = o.yaw;
    r.groups[o.id] = 1;
    game.requiredKills = Math.max(game.requiredKills || 0, game.spawnedCount || 0);
    const maxHp = C().hp || 340, floors = C().phases || [0.5, 0.25];
    B = { o, z, pair, phase, maxHp, hp: maxHp * (phase === 3 ? floors[1] : phase === 2 ? floors[0] : 1), st: "walk", t: 0, gapT: num(o.firstGap, C().firstGap || 2.4), moveI: 0,
      shield: C().shield || 3, cycle: 0, queue: null, q: null, qN: 0, qLock: 0, wait: 0, rights: 0, misses: 0, openN: 0, beat: r.beatI - 1,
      line: null, lines: 0, pod: null, megaT: 0, scramble: null, hints: {}, bar: null, log: [], hurts: 0, opens: 0 };
    dress(z);
    // the shield round him; its plates
    const rr = makeRings();
    game.scene.add(rr.g);
    B.rings = rr;
    plates = Object.assign(makePlates(game), { on: false });
    game.scene.add(plates.mesh);
    // his pose over the gait's (js/zombieanim.js), while a move has one
    z.animStep = function (dt, moved) { G.Zombie.prototype.animStep.call(this, dt, moved); pose(this, dt); };
    ask(game);
    bar(true);
    return z;
  }
  function bar(force) {
    if (!B || !G.UI || !G.UI.setBossBar) return;
    const pct = Math.max(0, (B.hp / B.maxHp) * 100), key = pct.toFixed(1) + "|" + (B.st === "open" ? 1 : 0) + "|" + B.phase;
    if (!force && key === B.bar) return;
    B.bar = key;
    G.UI.setBossBar(true, T(B.o.name || "story.who." + (B.o.who || B.o.id)), pct, B.st === "open", B.phase, C().phases || [0.5, 0.25]);
    shieldLine();
  }
  // what to do about the move: the line under his bar, the first two times
  function hint(id, sec) {
    const n = (B.hints[id] = (B.hints[id] || 0) + 1);
    if (n <= 2 && G.UI && G.UI.setBossHint) G.UI.setBossHint(T("story.boss2.hint." + id), sec || 3.4);
  }
  // a caption of his: under the lines (the fight goes on under it)
  function shout(key) { if (G.StoryWhisper) G.StoryWhisper.show("“" + (G.StoryDialogue ? G.StoryDialogue.en(key) : T(key)) + "”", 2.6, "boss"); }

  // ---------------- the states ----------------
  function to(st) { B.st = st; B.t = 0; B.log.push(st); if (B.log.length > 60) B.log.shift(); bar(); shieldLine(); }      // (the shield's line: shown or not by the state)
  function walk(gap) { to("walk"); B.gapT = gap != null ? gap : ph(C().gap || [6.5, 5.2, 4], B.phase); }
  const fast = () => (B.phase >= 3 ? C().faster || 0.75 : 1);
  function nextMove(game) {
    const lists = B.o.moves || {}, list = lists[B.phase] || lists[1] || ["lineup", "podium"];
    let m = list[B.moveI % list.length];
    B.moveI++;
    // (the last line still out: the next move of another kind instead)
    if (m === "lineup" && B.line && B.line.zs.some((q) => q.alive)) { const alt = list.find((x, i) => x !== "lineup" && i >= B.moveI % list.length) || list.find((x) => x !== "lineup"); m = alt || "walk"; }
    if (m === "lineup") { to("lineup"); hint("lineup", 3.6); boss("snort"); }
    else if (m === "podium") { to("podium"); B.pod = null; hint("podium", 3.4); }
    else if (m === "megaphone") { to("mega"); hint("mega", 3.6); squeal(B.z.mesh.position.clone().setY(B.z.mesh.position.y + 2.1), 1); boss("roar_wind"); }
    else walk(1);
  }
  // LINE UP!: students out of the walkways' far ends, to the painted lines
  function callLine(game) {
    const r = run(), o = B.o;
    if (!r || !G.StoryScenes) return;
    const alive = game.zombies.filter((q) => q.alive).length;
    const n = Math.max(0, Math.min(ph(C().lineCount || [6, 7, 8], B.phase), (C().maxAlive || 8) - alive));
    if (!n) return;
    const before = new Set(game.zombies), id = o.id + "_line" + (++B.lines);
    G.StoryScenes.spawn(game, r, { id, at: o.from, count: n, kinds: ["normal"] });
    const zs = game.zombies.filter((q) => !before.has(q) && q.alive);
    const face = o.face || { x: B.z.mesh.position.x, z: B.z.mesh.position.z };
    // (the line from the middle of the painted lines outward -- its front row first -- and each student to the
    // nearest of those places: one line before the stage, not two knots at its ends)
    const spots = [], rows = {};
    (o.spots || []).forEach((s) => { (rows[s.z] = rows[s.z] || []).push(s); });
    Object.keys(rows).sort((a, b) => a - b).forEach((zk) => rows[zk].slice().sort((a, b) => Math.abs(a.x) - Math.abs(b.x)).forEach((s) => spots.push(s)));
    spots.splice(zs.length);
    zs.forEach((q) => {
      let bi = 0, bd = 1e9;
      spots.forEach((s, i) => { const d = Math.hypot(s.x - q.mesh.position.x, s.z - q.mesh.position.z); if (d < bd) { bd = d; bi = i; } });
      const s = spots.splice(bi, 1)[0] || { x: q.mesh.position.x, z: q.mesh.position.z };
      q.storyGoal = { x: s.x + (Math.random() - 0.5) * 0.3, z: s.z, yaw: Math.atan2(face.x - s.x, face.z - s.z), face, at: false };
      q.storyLine = id;
      q.speedMultiplier = Math.max(q.speedMultiplier || 1, C().lineK || 1.6);        // (hurrying to their places)
    });
    B.line = { id, zs, t: 0, out: 0, released: false, nextT: 0 };
  }
  function lineUpdate(game, dt) {
    const L = B.line;
    if (!L) return;
    L.t += dt;
    const waiting = L.zs.filter((q) => q.alive && q.storyGoal);
    if (!waiting.length) { if (L.zs.every((q) => !q.alive)) B.line = null; return; }
    // the line complete (or long enough waited): two at a time at the player, the nearest first
    const full = waiting.every((q) => q.storyGoal.at);
    if (!L.released && (full || L.t >= (C().formSec || 8) * fast())) {
      L.released = true; L.nextT = 0; L.why = full ? "full" : "time"; L.atSent = waiting.filter((q) => q.storyGoal.at).length;
      if (G.Audio && G.Audio.boss) G.Audio.boss("stampede", {});
      hint("charge", 3);
    }
    if (!L.released) return;
    L.nextT -= dt;
    if (L.nextT > 0) return;
    L.nextT = ph(C().release || [1.6, 1.15, 0.85], B.phase) * fast();
    const pp = game.yawObject.position;
    waiting.sort((a, b) => Math.hypot(a.mesh.position.x - pp.x, a.mesh.position.z - pp.z) - Math.hypot(b.mesh.position.x - pp.x, b.mesh.position.z - pp.z));
    waiting.slice(0, C().releaseN || 2).forEach((q) => { q.storyGoal = null; q.speedMultiplier = Math.max(q.speedMultiplier || 1, C().runK || 1.55); q._hold = 0; L.out++; });
  }
  // js/game.js updateZombies: a student lining up walks to their place and stands there, facing the stage -> true;
  // the player right up against the line: that one breaks from it (false: the usual chase)
  const tgtV = new THREE.Vector3(), faceV = new THREE.Vector3();
  function lineStep(game, z, dt, me) {
    const g = z.storyGoal;
    if (!g) return false;
    const p = z.mesh.position;
    if (Math.hypot(me.x - p.x, me.z - p.z) < (C().breakR || 1.8)) { z.storyGoal = null; z.speedMultiplier = Math.max(z.speedMultiplier || 1, C().runK || 1.55); return false; }
    const near = G.ColGrid.near(game.world, p.x, p.z, 2.4, z._cols || (z._cols = []));
    if (Math.hypot(g.x - p.x, g.z - p.z) > 0.4) {
      tgtV.set(g.x, p.y, g.z); tgtV.stopAt = 0.3;
      z.update(dt, tgtV, tgtV, near, G.save.settings.gameSpeed, null);
      g.at = false;
    } else {
      if (!g.at) z.speedMultiplier = 1;                   // (in place: their own pace again, till the line is sent)
      g.at = true;
      z._hold = Math.max(z._hold || 0, 0.1);
      faceV.set(g.face.x, p.y, g.face.z);
      z.update(dt, faceV, faceV, near, G.save.settings.gameSpeed, null);
    }
    p.y = G.getFloorHeightAt(game.world, p.x, p.z, p.y);
    return true;
  }

  // the podium: lifted, a red circle where the player stands, thrown into it
  function podium(game, dt) {
    const z = B.z, p = z.mesh.position, pp = game.yawObject.position, F = fx(game), k = fast();
    const lift = (C().podLift || 0.8) * k, warn = (C().podWarn || 1.2) * k, fly = (C().podFly || 0.5) * k;
    if (!B.pod) {
      const m = G.VoxelProps ? G.VoxelProps.build("podium", {}) : null;
      const at = { x: pp.x, z: pp.z };
      const R = C().podR || 2.4;
      const disc = F ? F.decal({ mode: "disc", x: at.x, z: at.z, y: G.getFloorHeightAt(game.world, at.x, at.z, pp.y - 1.7) + 0.06, r: R, w: 0.35, color: 0xff2a1a, opacity: 0.95, prog: 0 }) : null;
      if (m) { m.scale.setScalar(0.85); game.scene.add(m); }
      B.pod = { m, at, disc, R, t: 0, thrown: false, from: null, landed: false };
      boss("ball_wind");
    }
    const P = B.pod;
    P.t += dt;
    if (P.disc) P.disc.set({ prog: Math.min(1, P.t / warn) });
    // in his hands, rising overhead
    const yaw = Math.atan2(P.at.x - p.x, P.at.z - p.z), fx0 = Math.sin(yaw), fz0 = Math.cos(yaw);
    z.mesh.rotation.y += wrap(yaw - z.mesh.rotation.y) * Math.min(1, dt * 8);
    const top = (z.mesh.userData.top || 1.8) * z.mesh.scale.y;
    if (!P.thrown) {
      const u = Math.min(1, P.t / lift);
      if (P.m) { P.m.position.set(p.x + fx0 * 0.5, p.y + 0.6 + (top + 0.2 - 0.6) * u, p.z + fz0 * 0.5); P.m.rotation.set(0, yaw, Math.PI * u); }
      if (P.t >= warn - fly) { P.thrown = true; P.from = P.m ? P.m.position.clone() : new THREE.Vector3(p.x, p.y + top, p.z); boss("throw_heavy"); }
    } else if (!P.landed) {
      const u = Math.min(1, (P.t - (warn - fly)) / fly), fy = G.getFloorHeightAt(game.world, P.at.x, P.at.z, P.from.y);
      if (P.m) {
        P.m.position.set(P.from.x + (P.at.x - P.from.x) * u, P.from.y + (fy + 0.1 - P.from.y) * u + Math.sin(u * Math.PI) * 2.4, P.from.z + (P.at.z - P.from.z) * u);
        P.m.rotation.x = u * 4; P.m.rotation.z = Math.PI + u * 2;
      }
      if (u >= 1) {
        P.landed = true;
        const hitAt = new THREE.Vector3(P.at.x, fy + 0.4, P.at.z);
        if (G.Audio && G.Audio.boss) G.Audio.boss("slam", { pos: hitAt });
        if (F) { F.burst(P.at.x, fy + 0.3, P.at.z, 26, 0x8a5a32, 4, 0.18, 4); F.burst(P.at.x, fy + 0.2, P.at.z, 12, 0xc8b89a, 3, 0.12, 3); F.shock(P.at.x, P.at.z, P.R + 1, 0xffb070, 0.6); }
        if (G.StoryScreen) G.StoryScreen.shake(game, { sec: 0.35, amp: 0.05 });
        if (Math.hypot(pp.x - P.at.x, pp.z - P.at.z) < P.R && Math.abs(pp.y - 1.7 - fy) < 1.6) {
          const ax = pp.x - P.at.x, az = pp.z - P.at.z, l = Math.hypot(ax, az) || 1;
          hurt(game, C().podDamage || 0.3, { x: ax / l, z: az / l }, C().podPush || 1.6, 0.9);
        }
        if (P.m) away(P.m);
        P.m = null;
        if (P.disc) { P.disc.hide(); P.disc = null; }
      }
    } else if (P.t >= warn + 0.5) { B.pod = null; walk(); }
  }
  // the megaphone: a breath, its bell lit, a cone of sound
  function megaphone(game, dt) {
    const z = B.z, p = z.mesh.position, pp = game.yawObject.position, F = fx(game), wind = (C().megaWind || 1) * fast();
    const yaw = Math.atan2(pp.x - p.x, pp.z - p.z);
    if (B.t < wind * 0.85) z.mesh.rotation.y += wrap(yaw - z.mesh.rotation.y) * Math.min(1, dt * 6);
    const R = C().megaRange || 15, half = C().megaHalf || 0.55, dir = z.mesh.rotation.y;
    if (!B.cone && F) B.cone = F.decal({ mode: "sector", x: p.x, z: p.z, y: p.y + 0.06, r: R, half, w: 0.4, color: 0xffa040, opacity: 0.5, prog: 0, yaw: dir });
    if (B.cone) B.cone.set({ x: p.x, z: p.z, yaw: dir, prog: Math.min(1, B.t / wind), opacity: 0.35 + 0.55 * Math.min(1, B.t / wind), color: B.t > wind * 0.7 ? 0xff3a1a : 0xffa040 });
    if (B.megaGlow) { B.megaGlow.visible = true; B.megaGlow.material.opacity = Math.min(1, B.t / wind) * (0.6 + 0.4 * Math.sin(B.t * 30)); }
    if (B.t < wind || B.blasted) { if (B.blasted && B.t >= wind + 0.6) { B.blasted = false; if (B.cone) { B.cone.hide(); B.cone = null; } if (B.megaGlow) { B.megaGlow.material.opacity = 0; B.megaGlow.visible = false; } walk(); } return; }
    B.blasted = true;
    const mouth = B.mega ? B.mega.getWorldPosition(new THREE.Vector3()) : p.clone().setY(p.y + 2);
    blast(mouth);
    if (B.phase >= 2) { shout("story.ch1.d.somsakDis"); if (!B.saidDis && G.Audio && G.Audio.speak) { B.saidDis = true; G.Audio.speak("Dis. Ci. Pline!", { text: true, lang: "en", pitch: 0.55, rate: 0.8 }); } }
    if (F) { F.shock(p.x, p.z, R * 0.7, 0xffc080, 0.55); for (let i = 0; i < 3; i++) F.sparks(p.x + Math.sin(dir) * (2 + i * 3), p.y + 1.6, p.z + Math.cos(dir) * (2 + i * 3), 8, 0xffd8a0, 3); }
    // in the cone, nothing solid between: thrown back, the labels scrambled
    const dx = pp.x - p.x, dz = pp.z - p.z, d = Math.hypot(dx, dz);
    const inside = d < R && Math.abs(wrap(Math.atan2(dx, dz) - dir)) < half && Math.abs(pp.y - 1.7 - p.y) < 2;
    const clear = inside && (!G.Story.sees || G.Story.sees(game, new THREE.Vector3(mouth.x, mouth.y + 0.2, mouth.z), { x: pp.x, y: pp.y - 1.7, z: pp.z }));
    B.lastCone = { inside, clear };
    if (clear) {
      hurt(game, C().megaDamage || 0.08, { x: dx / (d || 1), z: dz / (d || 1) }, C().megaPush || 3.5, 0);
      scramble(game);
      B.coneHits = (B.coneHits || 0) + 1;
      if (B.coneHits <= 2) hint("cover", 3.6);
    } else if (inside) hint("covered", 2.6);
  }
  // the word labels' letters swapped for a while (Settings > Accessibility: storyScramble)
  function swapLetters(w) {
    const s = String(w), a = s.split("");
    if (a.length < 3) return s.split("").reverse().join("");
    const n = a.length >= 7 ? 2 : 1;
    for (let k = 0; k < n; k++) { const i = 1 + Math.floor(Math.random() * (a.length - 2)); const t = a[i]; a[i] = a[i + 1] || a[i - 1]; if (a[i + 1] != null) a[i + 1] = t; }
    const out = a.join("");
    return out === s ? s.slice(1) + s.charAt(0) : out;
  }
  function scramble(game) {
    if (G.save.settings.storyScramble === false) return;
    unscramble();
    const list = [];
    game.zombies.forEach((z) => {
      if (!z.alive || z === B.z || z.answer !== "shoot" || !z.labelText || z.labelText !== z.word) return;
      const s = swapLetters(z.word);
      z.labelText = s; z._label = null; z.setTarget(z.isTarget);
      list.push({ z, s });
    });
    B.scramble = { t: C().scrambleSec || 2, list };
    if (plates && plates.on && B.q) B.q.shown.forEach((w, i) => drawPlate(plates, i, swapLetters(w), "idle"));
    B.scrambled = (B.scrambled || 0) + 1;
    if (G.LexiLens) G.LexiLens.glitch(0.6);
  }
  function unscramble() {
    if (!B || !B.scramble) return;
    B.scramble.list.forEach(({ z, s }) => { if (z.alive && z.labelText === s) { z.labelText = z.word; z._label = null; z.setTarget(z.isTarget); } });
    B.scramble = null;
    if (plates && plates.on && B.q && B.qLock <= 0) B.q.shown.forEach((w, i) => drawPlate(plates, i, w, "idle"));
  }
  // the shield down: on his knees, the patches lit
  function open(game) {
    to("open");
    B.opens++;
    plates.on = false; B.q = null;
    unscramble();
    const F = fx(game), p = B.z.mesh.position;
    if (F) { F.shock(p.x, p.z, 4, 0x5ad8ff, 0.7); F.sparks(p.x, p.y + 1.4, p.z, 40, 0x5ad8ff, 5); }
    if (G.Audio && G.Audio.boss) { G.Audio.boss("pylon_break", { pos: p.clone().setY(p.y + 1.4) }); G.Audio.boss("hurt", { pos: p.clone().setY(p.y + 2), voice: VOICE }); }
    if (G.LexiLens) G.LexiLens.sys("story.ch1.sys.patches", {}, { now: true, dur: C().openSec || 8 });
    hint("open", 4);
    if (B.mark) B.mark.visible = true;
    B.openHits = 0;
    shieldLine();
  }
  function shieldUp(game) {
    B.cycle++;
    B.shield = C().shield || 3;
    if (G.LexiLens && G.LexiLens.cut) G.LexiLens.cut("story.ch1.sys.patches");          // (its window over: its line too)
    B.queue = null;
    if (B.mark) B.mark.visible = false;
    if (G.VoxelChars) G.VoxelChars.setLock(B.z.mesh, false);
    const p = B.z.mesh.position;
    if (G.Audio && G.Audio.boss) G.Audio.boss("seal", { pos: p.clone().setY(p.y + 1.4) });
    ask(game);
    walk(1.6);
  }
  // below a phase's line: a roar, the save, the next phase's moves
  function phaseUp(game) {
    const r = run(), o = B.o;
    B.phase++;
    to("phase");
    plates.on = false; B.q = null;
    unscramble();
    if (B.mark) B.mark.visible = false;
    if (r) r.flags.add(o.id + ":p" + B.phase);
    if (G.LexiLens && G.LexiLens.cut) G.LexiLens.cut("story.ch1.sys.patches");
    boss("phase");
    const p = B.z.mesh.position, F = fx(game);
    if (F) F.shock(p.x, p.z, 9, 0xff5a3a, 0.9);
    if (G.StoryScreen) G.StoryScreen.shake(game, { sec: 0.4, amp: 0.04 });
    if (B.phase === 2) shout("story.ch1.d.somsakDis");
    if (B.phase >= 3) B.z.speed = C().speedP3 || 1.45;
    if (G.LexiLens) G.LexiLens.sys(B.phase >= 3 ? "story.ch1.sys.phase3" : "story.ch1.sys.phase2", {}, { glitch: true });
    // the save (the design's: as phases 2 and 3 begin) -- picked up there, the fight starts again in this phase
    if (r && G.Story.checkpoint) G.Story.checkpoint(game, Object.assign({}, o.cp || {}, { beat: B.beat }));
    // a box or two to keep going with
    ((o.drops && o.drops[B.phase]) || []).forEach((d) => { if (game.spawnDrop) game.spawnDrop(d.kind || "ammo", new THREE.Vector3(d.x, Number.isFinite(d.y) ? d.y : 0, d.z)); });
  }
  function summon(game) {
    const r = run();
    if (!r || !B.o.hall || !G.StoryScenes) return;
    G.StoryScenes.spawn(game, r, { id: B.o.id + "_scream", at: B.o.hall, count: C().screamers || 2, kinds: ["screamer"] });
    boss("summon");
    hint("screamers", 4);
    if (G.LexiLens) G.LexiLens.sys("story.ch1.sys.screamers", {}, { glitch: true });
  }

  // ---------------- the player hurt ----------------
  function hurt(game, frac, from, push, fall) {
    const pl = game.player;
    if (!pl || game.state !== "GAMEPLAY") return 0;
    const ab = G.Abilities ? G.Abilities.damageTakenMult() : 1;
    if (ab <= 0) return 0;
    let dmg = pl.maxHp * frac * (1 - (pl.armorPct || 0)) * ab;
    if (pl.hp >= pl.maxHp - 0.5) dmg = Math.min(dmg, pl.hp - 1);         // (never a kill from full health)
    pl.hp -= dmg;
    pl.wasHitThisLevel = true;
    G.UI.flashDamage();
    G.Audio.sfx("hurt");
    if (push) { const l = Math.hypot(from.x, from.z) || 1; for (let i = 0; i < 12; i++) game.tryMove((from.x / l) * push / 12, (from.z / l) * push / 12); }
    if (fall && G.StoryCam && G.StoryCam.fall) G.StoryCam.fall(fall);
    if (G.StoryScreen) G.StoryScreen.shake(game, { sec: 0.3, amp: 0.06 });
    B.hurts++;
    game.checkPlayerDeath();
    return dmg;
  }

  // ---------------- hits ----------------
  // js/game.js raycastShoot: the round meets a plate before anything else (a wall, a zombie) -> it is the answer
  function onShot(game, origin, dir, far) {
    if (!B || !plates || !plates.on || !B.q || game.mode !== "story") return false;
    const hit = plateOnRay(origin, dir, far);
    if (!hit) return false;
    // (a shotgun's other pellets, the same shot: taken by the plate, not answered again)
    if (B.qLock <= 0) answer(game, hit.i);
    return true;
  }
  function onHit(game, z, dmg, at, info) {
    if (!B || z !== B.z || !z.principal) return false;
    if (B.st === "open") {
      const head = !!(info && info.head);
      const pts = dmg * (head ? 1 : C().bodyK || 0.35);
      B.openHits++;
      if (head) { B.patchHits = (B.patchHits || 0) + 1; G.UI.showHitmarker(true); }
      else if (B.openHits === 3 && !B.patchHits) hint("patch", 3);
      damage(game, pts, at);
      return true;
    }
    if (B.st === "down") return true;
    // the shield: a clink, a fleck of blue where it struck
    if ((B.clinkT || 0) <= 0) {
      B.clinkT = 0.2;
      const a = A(), pos = at ? at.clone() : z.mesh.position.clone();
      if (a) a.group({ cat: "sfx", prio: 3, pos, dur: 0.2 }, () => { a.tone({ type: "triangle", freq: 2100, freqEnd: 1600, dur: 0.1, gain: 0.07, pos }); a.noise({ dur: 0.05, filter: "highpass", freq: 3200, gain: 0.05, pos }); });
      G.spawnHitParticles(game.scene, pos, 0x7ae0ff, G.save.settings.graphicsQuality);
      B.clinks = (B.clinks || 0) + 1;
      if (B.clinks === 2 || B.clinks === 12) hint("shield", 4);
    }
    return true;
  }
  function damage(game, pts, at) {
    const floors = C().phases || [0.5, 0.25], floor = B.phase === 1 ? floors[0] * B.maxHp : B.phase === 2 ? floors[1] * B.maxHp : 0;
    B.hp = Math.max(floor, B.hp - pts);
    const F = fx(game), p = B.z.mesh.position;
    if (F) F.sparks(p.x, p.y + 2.1, p.z, 10, 0x5ad8ff, 3);
    if ((B.ouchT || 0) <= 0) { B.ouchT = 0.6; boss("hurt"); }
    bar();
    if (B.hp <= floor + 0.01) {
      if (floor > 0) phaseUp(game);
      else down(game);
    }
  }
  // (not through js/game.js onZombieDeath: his end is no answer, right or wrong, to whatever is being asked)
  function down(game) {
    const z = B.z, r = run();
    to("down");
    plates.on = false; B.q = null;
    unscramble();
    z.hp = 0; z.alive = false;
    if (r) r.flags.add("boss:" + B.o.id);
    onDeath(game, z);
    game.totalZombiesKilled = (game.totalZombiesKilled || 0) + 1;
    game.zombies = game.zombies.filter((q) => q !== z);
    game.ensureTargetHasMatch();
  }
  // js/game.js startDeathAnimation: he is not blown to blocks -- he kneels, the megaphone falls and plays the
  // speech he recorded; then he lies down. No blood, whatever the settings
  function onDeath(game, z) {
    if (!B || z !== B.z) return false;
    if (z.sprite) z.sprite.visible = false;
    if (B.mark) B.mark.visible = false;
    if (B.megaGlow) B.megaGlow.visible = false;
    if (G.LexiLens && G.LexiLens.cut) G.LexiLens.cut("story.ch1.sys.patches");
    hideRings();
    if (G.UI && G.UI.setBossBar) G.UI.setBossBar(false);
    if (shieldEl) shieldEl.classList.add("hidden");
    document.body.classList.remove("story-plates-on");
    const p = z.mesh.position, floorY = G.getFloorHeightAt(game.world, p.x, p.z, p.y);
    body = { mesh: z.mesh, t: 0, floorY, o: B.o, scale: z.mesh.scale.y, mega: B.mega, megaDown: false, spoke: false, yaw: z.mesh.rotation.y };
    B.mega = null;
    if (G.Audio && G.Audio.boss) G.Audio.boss("hurt", { pos: p.clone().setY(p.y + 2), voice: VOICE });
    if (G.StoryScreen) G.StoryScreen.shake(game, { sec: 0.25, amp: 0.025 });
    return true;
  }
  function hideRings() { if (B && B.rings) B.rings.g.visible = false; }

  // ---------------- each frame ----------------
  function update(game, dt) {
    if (body) fallen(game, dt);
    if (G.BossFX && G.BossFX.scene === game.scene && (B || body) && !(G.Bosses && G.Bosses.phase)) G.BossFX.update(game._slowmoT > 0 ? dt * 0.35 : dt);
    if (!B) return;
    const z = B.z, r = run();
    if (!r || r.over || r.dead) return;
    if (B.st === "down" || !z.alive) { placePlates(game, dt); return; }
    const wdt = game._slowmoT > 0 ? dt * 0.35 : dt, p = z.mesh.position;
    B.t += wdt;
    if (B.qLock > 0) {
      B.qLock -= wdt;
      if (B.qLock <= 0 && B.wait > 0) {
        B.wait = 0;
        if (B.shield <= 0) open(game);
        else if (B.st !== "open" && B.st !== "phase") ask(game);
      }
    }
    if (B.clinkT > 0) B.clinkT -= wdt;
    if (B.ouchT > 0) B.ouchT -= wdt;
    if (B.scramble) { B.scramble.t -= wdt; if (B.scramble.t <= 0) unscramble(); }
    lineUpdate(game, wdt);
    // the shield's rings: round him, one for each layer left
    if (B.rings) {
      const g = B.rings.g, up = B.st !== "open" && B.st !== "phase";
      g.visible = up;
      g.position.set(p.x, p.y, p.z);
      const n = Math.max(0, Math.min(3, B.shield));
      if (n !== B.rings.n) { B.rings.n = n; if (n) B.rings.m.geometry = B.rings.geos[n]; }
      B.rings.m.visible = up && n > 0;
      B.rings.m.rotation.y += wdt * 0.7;
      B.rings.mat.opacity = 0.42 + 0.14 * Math.sin(B.t * 3.2);
    }
    placePlates(game, wdt);
    hot(game);
    const st = B.st, hold = st !== "walk";
    if (hold) { z._hold = Math.max(z._hold || 0, 0.12); z.attackCooldown = Math.max(z.attackCooldown, 0.3); z._atk = null; }
    z._holdNoTurn = st === "open" || st === "phase" || st === "podium" || (st === "mega" && B.t > (C().megaWind || 1) * fast() * 0.85);
    if (st === "walk") {
      B.gapT -= wdt;
      if (B.gapT <= 0) nextMove(game);
    } else if (st === "lineup") {
      if (!B.whistled) { B.whistled = true; whistle(p.clone().setY(p.y + 2.2)); }
      if (B.t >= 0.5 && !B.shouted) { B.shouted = true; shout("story.ch1.d.somsakLine"); }
      if (B.t >= (C().lineWind || 1.4) * fast()) { B.whistled = false; B.shouted = false; callLine(game); walk(); }
    } else if (st === "podium") podium(game, wdt);
    else if (st === "mega") megaphone(game, wdt);
    else if (st === "open") {
      if (G.VoxelChars) G.VoxelChars.setLock(z.mesh, true);
      if (B.mark) B.mark.material.opacity = 0.35 + 0.35 * Math.sin(B.t * 9);
      if (B.t >= (C().openSec || 8)) shieldUp(game);
    } else if (st === "phase") {
      if (B.t >= (C().phaseSec || 2.2)) {
        if (B.phase >= 3 && !B.summoned) { B.summoned = true; summon(game); }
        shieldUp(game);
      }
    }
    if (B) bar();
  }
  // the plate under the crosshair: lit
  const eyeV = new THREE.Vector3(), fwdV = new THREE.Vector3();
  function hot(game) {
    if (!plates || !plates.on || !B.q || B.qLock > 0 || B.scramble) return;
    game.camera.getWorldPosition(eyeV); game.camera.getWorldDirection(fwdV);
    const h = plateOnRay(eyeV, fwdV, 60), k = h ? h.i : -1;
    B.q.shown.forEach((w, i) => drawPlate(plates, i, w, i === k ? "hot" : "idle"));
    B.hot = k;
  }
  // his pose over the gait's (after js/zombieanim.js has posed him)
  function pose(z, dt) {
    if (!B || z !== B.z) return;
    const u = z.mesh.userData, L = u.limbs, st = B.st;
    if (!L || !L.armR) return;
    B.pk = B.pk || {};
    const lifting = st === "podium" && B.pod && !B.pod.thrown, threw = st === "podium" && B.pod && B.pod.thrown;
    const want = st === "lineup" ? "whistle" : lifting ? "lift" : threw ? "throw" : st === "mega" ? "mega" : st === "open" ? "kneel" : st === "phase" ? "roar" : "";
    ["whistle", "lift", "throw", "mega", "kneel", "roar"].forEach((k) => { B.pk[k] = G.Anim.approach(B.pk[k] || 0, k === want ? 1 : 0, dt || 0.016, 0.1); });
    const K = B.pk, mix = (a, b, k) => a + (b - a) * k;
    const arm = (A2, x, zr, k) => { A2.shoulder.rotation.x = mix(A2.shoulder.rotation.x, x, k); A2.shoulder.rotation.z = mix(A2.shoulder.rotation.z, zr, k); };
    const up = (x, k) => { if (u.upper) u.upper.rotation.x = mix(u.upper.rotation.x, x, k); };
    const neck = (x, k) => { if (u.neck) u.neck.rotation.x = mix(u.neck.rotation.x, x, k); };
    // (the megaphone in the left hand: held down at his side unless it is used)
    if (K.mega < 0.5) arm(L.armL, -0.35, -0.12, 0.6);
    if (K.whistle > 0.01) { arm(L.armR, -2.6 + Math.sin(B.t * 18) * 0.04, 0.5, K.whistle); neck(-0.18, K.whistle); }
    if (K.lift > 0.01) { arm(L.armR, -2.9, -0.15, K.lift); arm(L.armL, -2.9, 0.15, K.lift); up(-0.25, K.lift); }
    if (K.throw > 0.01) { arm(L.armR, -0.9, -0.1, K.throw); arm(L.armL, -0.9, 0.1, K.throw); up(0.45, K.throw); }
    if (K.mega > 0.01) { arm(L.armL, -1.55 + Math.sin(B.t * 24) * 0.03, 0.35, K.mega); up(-0.12 + (B.t > (C().megaWind || 1) * fast() ? 0.2 : 0), K.mega); neck(-0.12, K.mega); }
    if (K.roar > 0.01) { arm(L.armR, -2.2, 0.6, K.roar); arm(L.armL, -2.2, -0.6, K.roar); up(-0.3, K.roar); neck(-0.4, K.roar); }
    // on his knees, bent over, the patches on his nape to the sky (and to the player)
    const kn = K.kneel || 0;
    if (kn > 0.01) {
      L.legL.hip.rotation.x = mix(L.legL.hip.rotation.x, 1.45, kn); L.legR.hip.rotation.x = mix(L.legR.hip.rotation.x, 1.45, kn);
      // (on his knees, bowed -- not down on his face: the patches' mark shows through his head to whoever is in front)
      up(0.42 + Math.sin(B.t * 2.4) * 0.04, kn); neck(0.68, kn);
      arm(L.armR, -0.5, 0.25, kn); arm(L.armL, -0.5, -0.25, kn);
    }
    // (the knees: the body lower by the legs' length -- they lie back along the ground)
    const hipY = (u.hipY || 12 * PX());
    const lowered = hipY * 0.86 * kn;
    if (u.upper) u.upper.position.y = hipY - lowered;
    L.legL.hip.position.y = hipY - lowered; L.legR.hip.position.y = hipY - lowered;
  }
  // down: on his knees (as he is), the megaphone out of his hand onto the ground, its speech; then he lies down
  function fallen(game, dt) {
    body.t += dt;
    const m = body.mesh, u = m.userData, L = u.limbs, P = PX(), hipY = u.hipY || 12 * P;
    const kn = Math.min(1, body.t / 0.8);
    if (L && L.legL) {
      L.legL.hip.rotation.x = 1.45 * kn; L.legR.hip.rotation.x = 1.45 * kn;
      const low = hipY * 0.86 * kn;
      if (u.upper) u.upper.position.y = hipY - low;
      L.legL.hip.position.y = hipY - low; L.legR.hip.position.y = hipY - low;
      if (u.upper) u.upper.rotation.x = 0.35 * kn;
      L.armR.shoulder.rotation.set(-0.3 * kn, 0, 0.15); L.armL.shoulder.rotation.set(-0.3 * kn, 0, -0.15);
      if (u.neck) u.neck.rotation.set(0.4 * kn, 0, 0);
    }
    // the megaphone: dropped, on the ground before him -- and his speech out of it
    if (!body.megaDown && body.t > 0.9 && body.mega) {
      body.megaDown = true;
      const w = body.mega.getWorldPosition(new THREE.Vector3());
      if (body.mega.parent) body.mega.parent.remove(body.mega);
      const fwd = { x: Math.sin(body.yaw), z: Math.cos(body.yaw) };
      body.mega.scale.setScalar(1.05 * body.scale);
      body.mega.position.set(w.x + fwd.x * 0.6, body.floorY + 0.14, w.z + fwd.z * 0.6);
      body.mega.rotation.set(0, body.yaw + 1.3, Math.PI / 2);
      game.scene.add(body.mega);
      sfx("rattle", body.mega.position.clone());
    }
    if (!body.spoke && body.t > 1.4) {
      body.spoke = true;
      squeal(body.mega ? body.mega.position.clone() : m.position.clone(), 0.6);
      if (G.StoryDialogue) G.StoryDialogue.say([{ who: "megaphone", line: body.o.speech || "story.ch1.d.somsakSpeech", voice: true, pitch: 0.7, rate: 0.82 }]);
    }
    // ...then over, slowly, on his side
    const t2 = Math.max(0, body.t - (body.o.lieAt || 6.2)), e = Math.min(1, t2 / 1.8), ee = e * e * (3 - 2 * e);
    m.rotation.z = (u.baseLean || 0) + 1.42 * ee;
    m.position.y = body.floorY + 0.25 * body.scale * ee;
    if (e >= 1 && !body.thud) {
      body.thud = true;
      if (G.StoryScreen) G.StoryScreen.thud(m.position.clone());
      // his whistle, on its lanyard: to be taken (the reward -- round 11's collectibles)
      const d = body.o.drop;
      if (d && d.id && G.StoryUse && run()) G.StoryUse.add(game, { id: d.id, at: { x: m.position.x, y: body.floorY, z: m.position.z }, size: [1.6, 0.9, 1.6], lift: 0.3, prompt: d.prompt || "story.use.generic", sound: "pickup" });
    }
  }

  // ---------------- the word box ----------------
  // (while no zombie is the one asked: the shield's sentence, and what to do with it)
  function line() { return B && B.q && plates && plates.on && B.st !== "down" ? B.q.sentence : null; }
  function label() { return B && B.q && plates && plates.on && B.st !== "down" ? T("story.boss2.label") : null; }

  // (out of the level, its geometry freed: the materials are every character's and every prop's, kept)
  function away(m) {
    if (!m) return;
    if (m.parent) m.parent.remove(m);
    m.traverse((o) => { if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose(); if (o.material && o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose(); });
  }
  function reset(game) {
    game = game || G.Game;
    if (B) {
      unscramble();
      if (B.pod) { if (B.pod.m) away(B.pod.m); if (B.pod.disc) B.pod.disc.hide(); }
      if (B.cone) B.cone.hide();
      if (B.rings) { away(B.rings.g); B.rings.geos.forEach((q) => { if (q) q.dispose(); }); }
      if (G.UI && G.UI.setBossBar) G.UI.setBossBar(false);
      // (the fight cut short -- another scene, the run started again: he goes with it; his students let go)
      if (game && game.zombies) game.zombies.forEach((q) => { if (q.storyGoal) q.storyGoal = null; });
      if (B.z && B.z.alive && game && game.zombies) {
        game.zombies = game.zombies.filter((q) => q !== B.z);
        B.z.alive = false;
        away(B.z.mesh);
      }
    }
    if (plates) { away(plates.mesh); plates.mesh.material.dispose(); plates = null; }
    if (shieldEl) { if (shieldEl.parentNode) shieldEl.parentNode.removeChild(shieldEl); shieldEl = null; }
    document.body.classList.remove("story-plates-on");
    if (body) { away(body.mesh); if (body.mega) away(body.mega); }
    const F = G.BossFX;
    if ((B || body) && F && game && F.scene === game.scene && F.debris && !(G.Bosses && G.Bosses.phase)) { F.clearTransient(); [F.debris, F.motes].forEach((m) => { if (m) m.visible = false; }); }
    B = null; body = null;
  }
  function info() {
    const bd = body ? { st: "down", lying: body.t > (body.o.lieAt || 6.2) + 1.8, spoke: !!body.spoke, megaDown: !!body.megaDown, t: body.t } : null;
    if (!B) return bd;
    return { body: bd, lying: !!(bd && bd.lying), id: B.o.id, st: B.st, t: B.t, phase: B.phase, hp: B.hp, maxHp: B.maxHp, pct: Math.round((B.hp / B.maxHp) * 1000) / 10, shield: B.shield, cycle: B.cycle,
      q: B.q ? { sentence: B.q.sentence, shown: B.q.shown.slice(), k: B.q.k, answer: B.q.answer, design: !!B.q.design, word: B.q.pair ? B.q.pair[0] : null } : null,
      qLock: B.qLock, qN: B.qN, rights: B.rights, misses: B.misses, opens: B.opens, moveI: B.moveI, gapT: B.gapT, hurts: B.hurts, lines: B.lines,
      line: B.line ? { n: B.line.zs.length, alive: B.line.zs.filter((q) => q.alive).length, waiting: B.line.zs.filter((q) => q.alive && q.storyGoal).length, at: B.line.zs.filter((q) => q.alive && q.storyGoal && q.storyGoal.at).length, released: B.line.released, out: B.line.out, why: B.line.why || null, atSent: B.line.atSent || 0, t: B.line.t } : null,
      pod: B.pod ? { at: Object.assign({}, B.pod.at), t: B.pod.t, thrown: B.pod.thrown, landed: B.pod.landed, r: B.pod.R } : null, cone: B.lastCone || null, coneHits: B.coneHits || 0,
      scramble: !!B.scramble, scrambled: B.scrambled || 0, plates: !!(plates && plates.on), hot: B.hot, clinks: B.clinks || 0, patchHits: B.patchHits || 0, beat: B.beat, log: B.log.slice() };
  }
  // the plates as the test needs them: where each is, its word
  function plateInfo() { return plates ? plates.list.map((pl) => ({ word: pl.word, state: pl.state, pos: pl.pos.clone(), yaw: pl.yaw, visible: pl.visible && plates.mesh.visible })) : []; }

  return { start, warm, update, reset, onShot, onHit, onDeath, lineStep, info, plateInfo, line, label, pose, swapLetters,
    get z() { return B ? B.z : null; }, get active() { return !!B && B.st !== "down"; }, get body() { return body; }, get state() { return B; } };
})();
