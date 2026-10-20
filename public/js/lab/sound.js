// ===================================================================
// The Sound Lab (overhaul, round 3) -- ?lab=sound
// -------------------------------------------------------------------
// Fetched by js/debug.js only when the address asks for it. It opens the
// school with nobody in it (the player cannot die) and a panel to hear the
// mixer at work:
//   the meter      the master's peak (after the limiter and the ceiling) and
//                  the voices playing against the graphics level's limit
//   a gun          its shot (the drawn buffers once they are ready), a burst
//                  of ten, its reload's steps, its draw
//   a sound        any event of the sound bank (js/data/soundbank.js), from
//                  here, ahead, left, right or behind
//   the room       where you stand (Auto) or any of the six spaces, to hear
//                  each reverb; the crossfade between them as it is chosen
//   measure        every gun drawn and measured: its peak and its loudness,
//                  each family's spread before and after the evening out --
//                  the table of the round's report (G.SoundLab.report)
//   stress         js/debug.js's stress test
// Nothing here is saved.
// ===================================================================
window.G = window.G || {};

G.SoundLab = {
  cur: "pistol",
  report: null,

  async start() {
    const T = (k) => G.T(k);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > (ms || 60000)) return false; await wait(150); } return true; };
    const note = document.createElement("div");
    note.className = "slab-note";
    note.textContent = T("slab.loading");
    document.body.appendChild(note);
    await until(() => G.Game && G.Game.renderer && G.Start && (G.Start.shown || (G.Lobby && G.Lobby.visible && G.Lobby.visible())));
    if (G.Start.shown) { G.Start.enter(); await wait(700); }
    if (G.Modal.isOpen("brightness") && G.BrightnessCal) G.BrightnessCal.ok();
    G.Game.startLevel(1);
    await until(() => G.Game.state === "GAMEPLAY" && G.Game.wsm, 30000);
    note.remove();
    const g = G.Game;
    G.Spawner.update = function () {};
    g.requiredKills = 1e9;
    g.clearZombies();
    g.player.hp = g.player.maxHp = 1e6;
    if (G.Tutorial && G.Tutorial.current) G.Tutorial.skip();
    this.buildPanel();
    const frame = () => { requestAnimationFrame(frame); this.each(); };
    requestAnimationFrame(frame);
  },

  def() { return G.WEAPON_DEFS[this.cur] || G.WEAPON_DEFS.pistol; },
  // a point 6 m from the ear: ahead, left, right, behind (or null: here)
  at(where) {
    const g = G.Game, p = g.yawObject.position, yaw = g.yawObject.rotation.y;
    const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), r = new THREE.Vector3(-f.z, 0, f.x);
    const v = { front: f, behind: f.clone().negate(), left: r.clone().negate(), right: r }[where];
    return v ? p.clone().addScaledVector(v, 6) : null;
  },

  // every frame: the player kept alive, the meter
  each() {
    const g = G.Game, A = G.Audio;
    if (!g.player || g.state !== "GAMEPLAY") return;
    g.player.hp = g.player.maxHp;
    const m = document.getElementById("slab-meter"), txt = document.getElementById("slab-peak");
    if (!m || !A.ctx) return;
    const pk = A.peakDb(), c = A.counts(), now = performance.now();
    // the bar: -60..0 dBFS, the peak held for a second
    if (!(this._hold > pk) || now - this._holdT > 1000) { this._hold = pk; this._holdT = now; }
    const w = (d) => Math.max(0, Math.min(100, ((d + 60) / 60) * 100));
    m.style.setProperty("--v", w(pk) + "%");
    m.style.setProperty("--h", w(this._hold) + "%");
    if (now - (this._txtT || 0) > 150) {
      this._txtT = now;
      txt.textContent = G.T("slab.peak", { p: Number.isFinite(this._hold) ? this._hold.toFixed(1) : "-∞", n: c.total || 0, t: G.CONFIG.audio.total[A.tier()] })
        + " · " + ((G.Acoustics && G.Acoustics.zone) || "-");
    }
  },

  // a reload's steps at a pace like the hands' (the real ones come from G.WeaponSM's markers)
  reload() {
    const def = this.def(), arch = G.ViewModel.family(def);
    const seq = /shotgun_pump/.test(arch) ? [["start", 0], ["shell", 0.35], ["shell", 0.75], ["pump", 1.2], ["done", 1.55]]
      : /sniper/.test(arch) ? [["start", 0], ["bolt", 0.25], ["out", 0.5], ["in", 1.0], ["bolt", 1.45], ["done", 1.8]]
      : [["start", 0], ["out", 0.3], ["grab", 0.55], ["in", 0.95], ["slap", 1.15], ["bolt", 1.45], ["done", 1.7]];
    const tag = "lab-reload:" + Date.now();
    seq.forEach(([k, t]) => setTimeout(() => G.GunAudio.reload(k, def, tag), t * 1000));
  },

  async measure(btn) {
    const out = document.getElementById("slab-table");
    btn.disabled = true;
    const rows = await G.GunAudio.measureAll((i, n) => { btn.textContent = G.T("slab.measuring", { n: i, t: n }); });
    btn.disabled = false;
    btn.textContent = G.T("slab.measure");
    // by family: its guns' loudness before and after, the spread of each
    const fams = {};
    rows.forEach((r) => { (fams[r.family] = fams[r.family] || []).push(r); });
    const sum = Object.keys(fams).map((f) => {
      const L = fams[f], b = L.map((r) => r.rms), a = L.map((r) => r.after), pk = L.map((r) => r.peak);
      const rng = (x) => Math.max.apply(null, x) - Math.min.apply(null, x);
      return { family: f, n: L.length, median: L[0].famDb, before: +rng(b).toFixed(1), after: +rng(a).toFixed(1), peakMax: Math.max.apply(null, pk) };
    });
    this.report = { guns: rows, families: sum };
    const esc = (s) => G.escapeHtml(String(s));
    out.innerHTML = `<table><tr><th>${esc(G.T("slab.family"))}</th><th>n</th><th>${esc(G.T("slab.median"))}</th><th>${esc(G.T("slab.before"))}</th><th>${esc(G.T("slab.after"))}</th><th>${esc(G.T("slab.peakMax"))}</th></tr>`
      + sum.map((s) => `<tr><td>${esc(G.T("family." + s.family))}</td><td>${s.n}</td><td>${s.median}</td><td>${s.before}</td><td>${s.after}</td><td>${s.peakMax}</td></tr>`).join("") + "</table>";
    return this.report;
  },

  buildPanel() {
    const T = (k) => G.T(k), esc = (s) => G.escapeHtml(String(s));
    const st = document.createElement("style");
    st.textContent = `.slab{position:fixed;right:8px;top:44px;z-index:8000;width:260px;max-height:calc(100vh - 60px);overflow:auto;
      background:rgba(10,12,16,.88);color:#e6ebf0;border:1px solid #4f6a86;border-radius:4px;padding:10px;font:13px/1.35 system-ui,sans-serif}
      .slab h3{margin:0 0 6px;font-size:14px;letter-spacing:.04em}.slab select{width:100%;margin:2px 0 6px;font-size:13px;padding:4px}
      .slab .row{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}.slab button{flex:1 1 30%;min-height:30px;background:#18212b;color:#e6ebf0;
      border:1px solid #4f6a86;border-radius:3px;font-size:12px;cursor:pointer}.slab button.on{background:#2f4a66;border-color:#9cc3e8}
      .slab label{display:block;margin-top:4px;color:#b8c4cf;font-size:12px}
      #slab-meter{position:relative;height:12px;background:#0b0f13;border:1px solid #33465a;border-radius:2px;margin:4px 0 2px;overflow:hidden}
      #slab-meter::before{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--v,0%);background:linear-gradient(90deg,#3f9a5a 0 75%,#d6b440 75% 92%,#d0533f 92%)}
      #slab-meter::after{content:"";position:absolute;top:0;bottom:0;left:var(--h,0%);width:2px;background:#fff}
      #slab-peak{font:11px ui-monospace,Consolas,monospace;color:#9cc3e8}
      .slab table{width:100%;border-collapse:collapse;font:11px ui-monospace,Consolas,monospace;margin-top:6px}.slab td,.slab th{border-bottom:1px solid #2a3846;padding:2px 3px;text-align:right}
      .slab td:first-child,.slab th:first-child{text-align:left}
      .slab-note{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9500;background:rgba(0,0,0,.8);color:#fff;padding:12px 18px;border-radius:4px;font:14px system-ui}`;
    document.head.appendChild(st);
    // every gun, by family
    const fams = {};
    Object.values(G.WEAPON_DEFS).forEach((d) => { const f = G.ViewModel.family(d); (fams[f] = fams[f] || []).push(d); });
    const order = ["pistol", "revolver", "smg", "rifle", "shotgun_pump", "shotgun_semi", "sniper_bolt", "lmg", "special"];
    const guns = order.filter((f) => fams[f]).map((f) => `<optgroup label="${esc(T("family." + f))}">${fams[f].map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</optgroup>`).join("");
    const events = Object.keys(G.SOUND_BANK).map((id) => `<option value="${id}">${esc(id)}</option>`).join("");
    const zones = ["corridor", "underground", "room", "hall", "warehouse", "outdoor"];
    const el = document.createElement("div");
    el.className = "slab";
    el.innerHTML = `<h3>${esc(T("slab.title"))}</h3>
      <div id="slab-meter"></div><div id="slab-peak"></div>
      <label>${esc(T("slab.gun"))}<select id="slab-gun">${guns}</select></label>
      <div class="row"><button data-a="shot">${esc(T("slab.shot"))}</button><button data-a="burst">${esc(T("slab.burst"))}</button><button data-a="reload">${esc(T("slab.reload"))}</button><button data-a="draw">${esc(T("slab.draw"))}</button></div>
      <label>${esc(T("slab.event"))}<select id="slab-event">${events}</select></label>
      <div class="row">${["here", "front", "left", "right", "behind"].map((w) => `<button data-at="${w}">${esc(T("slab." + w))}</button>`).join("")}</div>
      <label>${esc(T("slab.room"))}<select id="slab-zone"><option value="">${esc(T("slab.auto"))}</option>${zones.map((z) => `<option value="${z}">${esc(T("slab.zone." + z))}</option>`).join("")}</select></label>
      <div class="row"><button data-a="captions">${esc(T("slab.captions"))}</button><button data-a="stress">${esc(T("slab.stress"))}</button></div>
      <div class="row"><button data-a="measure" id="slab-measure">${esc(T("slab.measure"))}</button></div>
      <div id="slab-table"></div>`;
    document.body.appendChild(el);
    this.panel = el;
    const sel = el.querySelector("#slab-gun");
    sel.value = this.cur;
    sel.onchange = () => { this.cur = sel.value; G.GunAudio.prepare([this.cur]); sel.blur(); };
    const zs = el.querySelector("#slab-zone");
    zs.onchange = () => { G.Acoustics.force = zs.value || null; zs.blur(); };
    el.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        G.Audio.unlock();
        const a = b.dataset.a, def = this.def();
        if (b.dataset.at) { const e = G.SOUND_BANK[el.querySelector("#slab-event").value]; if (e) e.play(this.at(b.dataset.at)); }
        if (a === "shot") G.GunAudio.shot(def, {});
        if (a === "burst") for (let i = 0; i < 10; i++) setTimeout(() => G.GunAudio.shot(def, {}), i * Math.max(60, def.fireRate || 100));
        if (a === "reload") this.reload();
        if (a === "draw") G.GunAudio.draw(def);
        // (this session only: Settings keeps the real choice -- G.Captions.force)
        if (a === "captions") { G.Captions.force = !G.Captions.force; b.classList.toggle("on", G.Captions.force); }
        if (a === "stress" && G.Debug) { const on = !!G.Debug.stress(); b.classList.toggle("on", on && !!G.Debug._stress); }
        if (a === "measure") this.measure(b);
        b.blur();
      };
    });
    G.GunAudio.prepare([this.cur]);
  },
};

G.SoundLab.start();
