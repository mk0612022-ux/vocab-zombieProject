// ===================================================================
// The Zombie Gallery (overhaul, round 4) -- ?lab=zombies
// -------------------------------------------------------------------
// Fetched by js/debug.js only when the address asks for it. Every kind
// (G.ZOMBIE_KINDS) three times over, each a fresh random look, seen from the
// front and from three-quarters, on a plain stage in a plain light (its own
// renderer: nothing of the level's night or fog), five kinds a page. Every
// animation plays on all of them at once:
//   idle, walk (each kind its own gait), attack (wind-up and strike), hit
//   (light, medium, heavy), special (the Screamer rears up and shrieks, the
//   Bloater swells, the Ironclad loses its helmet, the Reacher raises its
//   arm), death
// "Sheet" draws all of it into one picture (G.ZombieLab.sheet() -> a PNG
// data URL; the round's report saves it as docs/overhaul/zombie-sheet.png).
// Nothing here is saved.
// ===================================================================
window.G = window.G || {};

G.ZombieLab = {
  page: 0, anim: "walk", theme: "school", cells: [], t: 0,
  ANIMS: ["idle", "walk", "attack", "hitLight", "hitMedium", "hitHeavy", "special", "death"],
  VIEWS: [{ id: "front", yaw: 0 }, { id: "three", yaw: 0.72 }],

  async start() {
    const T = (k) => G.T(k);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > (ms || 60000)) return false; await wait(150); } return true; };
    await until(() => G.Game && G.Game.renderer && G.T && G.ZombieFactory);
    this.build();
    this.panel(T);
    let last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.step(dt);
      this.draw();
    };
    requestAnimationFrame(frame);
  },

  // ---- the stage ----
  build() {
    // (the debug overlay and its Stress button: not over the gallery)
    if (G.Debug) { if (G.Debug.el) G.Debug.el.style.display = "none"; if (G.Debug.btn) G.Debug.btn.style.display = "none"; }
    const c = document.createElement("canvas");
    c.className = "zlab-canvas";
    document.body.appendChild(c);
    this.canvas = c;
    this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.setScissorTest(true);
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(0x2a2f36);
    s.add(new THREE.HemisphereLight(0xdfe6f0, 0x3a3428, 0.75));
    const key = new THREE.DirectionalLight(0xfff2e0, 0.9); key.position.set(-3, 5, 6); s.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 0.55); rim.position.set(3, 3, -5); s.add(rim);
    // the materials of the level's look need its night: plain ones here, the same atlas
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: G.ZombieSkin.texture() });
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.layers.enable(2);          // (the words over the zombies are on layer 2: js/visuals.js)
    this.reroll();
    const fit = () => { this.renderer.setSize(window.innerWidth, window.innerHeight, false); c.style.width = "100vw"; c.style.height = "100vh"; };
    window.addEventListener("resize", fit);
    fit();
  },
  // every kind, three fresh looks each
  reroll() {
    this.cells.forEach((cl) => { this.scene.remove(cl.z.mesh); G.disposeObject3D(cl.z.mesh); });
    this.cells = [];
    const floor = this._floor || (this._floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x3a3e44 })));
    floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    G.ZOMBIE_KINDS.forEach((type, k) => {
      for (let v = 0; v < 3; v++) {
        const at = new THREE.Vector3(k * 8, 0, v * 8);
        const z = new G.Zombie(type, at, [G.T("zombie.kind." + type), ""], this.theme);
        z.setAnswer("shoot", "", { label: G.T("zombie.kind." + type) });
        z.mesh.traverse((o) => { if (o.isMesh && o.material === G.ZOMBIE_MATS.lambert) o.material = this.mat; });
        z.mesh.userData.hitboxes.forEach((h) => { h.visible = false; });
        this.scene.add(z.mesh);
        this.cells.push({ z, type, k, v, at, base: z.mesh.scale.x });
      }
    });
  },

  // ---- every animation, on every one of them ----
  step(dt) {
    this.t += dt;
    const a = this.anim, cyc = (p) => (this.t % p) / p;
    this.cells.forEach((cl) => {
      const z = cl.z, def = G.ZOMBIE_TYPES[z.type];
      ["_down", "_stagger", "_rear", "_stumbleT"].forEach((k) => { if (z[k] > 0) z[k] = Math.max(0, z[k] - dt); });
      z.mesh.position.copy(cl.at);
      cl._shown = true;
      let moved = 0;
      if (a === "walk") moved = def.speed * dt;
      if (a === "attack") {
        const ph = cyc(1.6);
        z._atk = ph < 0.45 ? { phase: "wind", t: 0 } : ph < 0.7 ? { phase: "strike", t: 0 } : null;
        if (ph >= 0.45 && !cl._struck) { cl._struck = true; z.lunge(); }
        if (ph < 0.45) cl._struck = false;
      } else z._atk = null;
      const every = (p, fn) => { const n = Math.floor(this.t / p); if (cl._n !== n) { cl._n = n; fn(); } };
      if (a === "hitLight") every(1.1, () => z.flinch());
      if (a === "hitMedium") every(1.4, () => { z._stagger = G.CONFIG.zombies.hit.staggerTime; });
      if (a === "hitHeavy") every(2.6, () => { z._down = G.CONFIG.zombies.hit.downTime; });
      if (a === "special") this.special(cl, dt);
      else if (cl._helmetOff) this.helmetBack(cl);
      if (a !== "special") z.mesh.scale.setScalar(cl.base);
      if (a === "death") {
        // down, then gone to smoke -- and back again
        const ph = cyc(2.4);
        z._down = ph < 0.6 ? 1 : 0;
        cl._shown = ph < 0.62;
      }
      z.animate(dt, moved);
    });
  },
  special(cl, dt) {
    const z = cl.z, ph = (this.t % 3) / 3;
    if (z.type === "screamer") {
      if (ph < 0.02 && !(z._rear > 0)) { z._rear = 2.2; z._screaming = false; }
      if (z._rear > 0 && z._rear < 1.2) z._screaming = true;
    } else if (z.type === "bloater") {
      const k = Math.min(1, ph / 0.8);
      const s = cl.base * (1 + 0.32 * k * k);
      z.mesh.scale.set(s * (1 + Math.sin(this.t * 40) * 0.03 * k), s, s);
    } else if (z.type === "ironclad") {
      const h = z.mesh.userData.helmet;
      if (h && ph > 0.3 && !cl._helmetOff) { cl._helmetOff = true; h.visible = false; }
      if (ph < 0.05 && cl._helmetOff) this.helmetBack(cl);
    } else if (z.type === "reacher" || z.type === "abomination") {
      z._atk = ph < 0.4 ? { phase: "wind", t: 0 } : null;
      if (ph > 0.4 && ph < 0.45) z.lunge();
    } else if (z.type === "fast" || z.type === "runt") {
      if (ph < 0.02) z._stumbleT = G.CONFIG.zombies.stumble.time;
      z.animate(0, z.speed * dt);
    }
  },
  helmetBack(cl) { const h = cl.z.mesh.userData.helmet; if (h) h.visible = true; cl._helmetOff = false; },

  // ---- the views ----
  // the camera for a cell: the kind's whole body, from the front or three-quarters
  aim(cl, view) {
    const z = cl.z;
    // (only this one on the stage)
    this.cells.forEach((c) => { c.z.mesh.visible = c === cl && c._shown !== false; });
    // its whole body and the word over it (a Headless's word is over the head
    // it carries, off to one side), from where it stands at rest
    if (!cl._box) {
      const b = new THREE.Box3();
      z.mesh.updateMatrixWorld(true);
      z.mesh.traverse((o) => { if (o.isMesh && !o.userData.hit && o.geometry) b.union(new THREE.Box3().setFromObject(o)); });
      const sp = z.sprite.getWorldPosition(new THREE.Vector3()), hw = z.sprite.scale.x * (z.mesh.scale.x || 1) * 0.35;
      b.expandByPoint(sp.clone().add(new THREE.Vector3(hw, 0.2, hw))); b.expandByPoint(sp.clone().add(new THREE.Vector3(-hw, 0.2, -hw)));
      b.min.y = 0;
      cl._box = { c: b.getCenter(new THREE.Vector3()).sub(cl.at), s: b.getSize(new THREE.Vector3()) };
    }
    const B = cl._box, h = Math.max(1.75, B.s.y), w = Math.max(B.s.x, B.s.z);
    // (a 30-degree view: the whole height and a margin at about twice its distance)
    const d = Math.max(h, w * 1.25) * 2.05 + 0.3, yaw = view.yaw;
    const cx = cl.at.x + B.c.x, cz = cl.at.z + B.c.z, cy = h * 0.5;
    this.camera.position.set(cx + Math.sin(yaw) * d, cy + 0.15, cz + Math.cos(yaw) * d);
    this.camera.lookAt(cx, cy, cz);
  },
  // five kinds a page: a row each, its three looks from the front and from three-quarters
  draw() {
    const r = this.renderer, W = window.innerWidth, H = window.innerHeight;
    const kinds = G.ZOMBIE_KINDS.slice(this.page * 5, this.page * 5 + 5);
    const head = 40, colW = W / 6, rowH = (H - head) / kinds.length;
    r.setScissorTest(true);
    r.setViewport(0, 0, W, H); r.setScissor(0, 0, W, H);
    r.setClearColor(0x15181c); r.clear();
    kinds.forEach((type, row) => {
      for (let v = 0; v < 3; v++) for (let vi = 0; vi < 2; vi++) {
        const cl = this.cells.find((c) => c.type === type && c.v === v);
        const x = (v * 2 + vi) * colW, y = H - head - (row + 1) * rowH;
        r.setViewport(x + 1, y + 1, colW - 2, rowH - 2); r.setScissor(x + 1, y + 1, colW - 2, rowH - 2);
        this.camera.aspect = (colW - 2) / (rowH - 2); this.camera.updateProjectionMatrix();
        this.aim(cl, this.VIEWS[vi]);
        r.render(this.scene, this.camera);
      }
    });
  },

  // the whole gallery in one picture: a row a kind (its name on the left),
  // three looks x two views -> a PNG data URL
  sheet(o) {
    o = o || {};
    const cw = o.cw || 220, ch = o.ch || 300, nameW = 190, headH = 56;
    const kinds = G.ZOMBIE_KINDS;
    const out = document.createElement("canvas");
    out.width = nameW + cw * 6; out.height = headH + ch * kinds.length;
    const g = out.getContext("2d");
    g.fillStyle = "#15181c"; g.fillRect(0, 0, out.width, out.height);
    g.fillStyle = "#e8edf2"; g.font = "bold 22px system-ui, sans-serif"; g.textBaseline = "middle";
    g.fillText(G.T("zlab.title") + " — " + G.T("zlab.sheetNote"), 16, headH / 2);
    g.font = "15px system-ui, sans-serif"; g.fillStyle = "#9aa6b2";
    for (let c = 0; c < 6; c++) g.fillText((c % 2 ? G.T("zlab.three") : G.T("zlab.front")) + " #" + (Math.floor(c / 2) + 1), nameW + c * cw + 10, headH - 12);
    const r = this.renderer, keep = { w: this.canvas.width, h: this.canvas.height };
    r.setPixelRatio(1);
    r.setSize(cw, ch, false);
    r.setScissorTest(false);
    this.camera.aspect = cw / ch; this.camera.updateProjectionMatrix();
    kinds.forEach((type, row) => {
      g.fillStyle = "#e8edf2"; g.font = "bold 18px system-ui, sans-serif";
      g.fillText(G.T("zombie.kind." + type), 14, headH + row * ch + ch / 2 - 12);
      g.fillStyle = "#9aa6b2"; g.font = "13px system-ui, sans-serif";
      g.fillText(G.T("zlab.wave", { n: (G.CONFIG.zombies.first[type] || 1) }), 14, headH + row * ch + ch / 2 + 12);
      for (let v = 0; v < 3; v++) for (let vi = 0; vi < 2; vi++) {
        const cl = this.cells.find((c) => c.type === type && c.v === v);
        this.aim(cl, this.VIEWS[vi]);
        r.setViewport(0, 0, cw, ch);
        r.setClearColor(0x2a2f36); r.clear();
        r.render(this.scene, this.camera);
        g.drawImage(this.canvas, nameW + (v * 2 + vi) * cw, headH + row * ch);
      }
    });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setSize(window.innerWidth, window.innerHeight, false);
    this.canvas.style.width = "100vw"; this.canvas.style.height = "100vh";
    void keep;
    return out.toDataURL("image/png");
  },

  panel(T) {
    const esc = (s) => G.escapeHtml(String(s));
    const st = document.createElement("style");
    st.textContent = `.zlab-canvas{position:fixed;inset:0;z-index:8400;display:block}
      .zlab{position:fixed;right:8px;top:8px;z-index:8500;width:230px;background:rgba(10,12,16,.9);color:#e6ebf0;border:1px solid #6b5a4a;
      border-radius:4px;padding:10px;font:13px/1.35 system-ui,sans-serif}.zlab h3{margin:0 0 6px;font-size:14px}
      .zlab .row{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}.zlab button{flex:1 1 45%;min-height:28px;background:#1d1a17;color:#e6ebf0;
      border:1px solid #6b5a4a;border-radius:3px;font-size:12px;cursor:pointer}.zlab button.on{background:#5a4430;border-color:#d8a86a}
      .zlab label{display:block;color:#b8c0c8;font-size:12px;margin-top:4px}.zlab small{display:block;color:#8a96a2;margin-top:4px}`;
    document.head.appendChild(st);
    const el = document.createElement("div");
    el.className = "zlab";
    el.innerHTML = `<h3>${esc(T("zlab.title"))}</h3>
      <label>${esc(T("zlab.anim"))}</label>
      <div class="row">${this.ANIMS.map((a) => `<button data-anim="${a}" class="${a === this.anim ? "on" : ""}">${esc(T("zlab.anim." + a))}</button>`).join("")}</div>
      <label>${esc(T("zlab.level"))}</label>
      <div class="row">${["school", "hospital", "bunker"].map((t) => `<button data-theme="${t}" class="${t === this.theme ? "on" : ""}">${esc(T("zlab.theme." + t))}</button>`).join("")}</div>
      <div class="row"><button data-a="prev">◀ ${esc(T("zlab.page"))}</button><button data-a="next">${esc(T("zlab.page"))} ▶</button></div>
      <div class="row"><button data-a="reroll">${esc(T("zlab.reroll"))}</button><button data-a="sheet">${esc(T("zlab.sheet"))}</button></div>
      <small>${esc(T("zlab.help"))}</small>`;
    document.body.appendChild(el);
    el.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        if (b.dataset.anim) { this.anim = b.dataset.anim; el.querySelectorAll("[data-anim]").forEach((x) => x.classList.toggle("on", x === b)); }
        if (b.dataset.theme) { this.theme = b.dataset.theme; el.querySelectorAll("[data-theme]").forEach((x) => x.classList.toggle("on", x === b)); this.reroll(); }
        if (b.dataset.a === "prev") this.page = (this.page + 1) % 2;
        if (b.dataset.a === "next") this.page = (this.page + 1) % 2;
        if (b.dataset.a === "reroll") this.reroll();
        if (b.dataset.a === "sheet") { const a = document.createElement("a"); a.href = this.sheet(); a.download = "zombie-sheet.png"; a.click(); }
        b.blur();
      };
    });
  },
};

G.ZombieLab.start();
