// ===================================================================
// The Weapon Lab (overhaul, round 1) -- ?lab=weapons
// -------------------------------------------------------------------
// Fetched by js/debug.js only when the address asks for it. It opens the
// school with nobody in it and a panel to try every gun: fire, hold the
// trigger, both kinds of reload, switch, inspect, aim, lower, run -- in slow
// motion if wanted (x0.5, x0.25, x0.1) -- with the debug overlay showing the
// state machine, its events and its checks. Nothing here is saved.
// ===================================================================
window.G = window.G || {};

G.WeaponLab = {
  cur: "pistol",
  hold: false, aim: false, run: false, endless: true, speed: 1,

  async start() {
    const T = (k) => G.T(k);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > (ms || 60000)) return false; await wait(150); } return true; };
    const note = document.createElement("div");
    note.className = "wlab-note";
    note.textContent = T("lab.loading");
    document.body.appendChild(note);
    await until(() => G.Game && G.Game.renderer && G.MainMenu && (G.MainMenu.visible() || (G.Lobby && G.Lobby.visible && G.Lobby.visible())));
    if (G.MainMenu.visible()) { G.MainMenu.toLobby(); await wait(700); }
    if (G.Modal.isOpen("brightness") && G.BrightnessCal) G.BrightnessCal.ok();
    G.Game.startLevel(1);
    await until(() => G.Game.state === "GAMEPLAY" && G.Game.wsm, 30000);
    note.remove();
    this.setupRun();
    this.buildPanel();
    const frame = () => { requestAnimationFrame(frame); this.each(); };
    requestAnimationFrame(frame);
  },

  // the school, empty: no zombies, no wave end, no death
  setupRun() {
    const g = G.Game;
    G.Spawner.update = function () {};
    g.requiredKills = 1e9;
    g.clearZombies();
    g.player.hp = g.player.maxHp = 1e6;
    if (G.Tutorial && G.Tutorial.current) G.Tutorial.skip();
    this.give("pistol");
  },

  // every frame: what the toggles hold down, the endless reserve
  each() {
    const g = G.Game, I = G.Input, kb = G.save.settings.keybinds;
    if (!g.player || g.state !== "GAMEPLAY") return;
    if (this.hold) I.mouseDown = true;
    if (this.aim) I.aimDown = true;
    if (this.run) { I.keys[kb.sprint] = true; I.keys[kb.forward] = true; }
    if (this.endless) g.player.gunSlots.forEach((id) => { const a = g.player.ammo[id]; if (a && a.reserve < 200) a.reserve = 999; });
    g.player.hp = g.player.maxHp;
    g.timeScale = this.speed;
    const st = document.getElementById("wlab-state");
    if (st && g.wsm) st.textContent = g.wsm.state + (g.wsm.rl ? " · " + g.wsm.rl.kind : "");
  },

  // the chosen gun in slot 1, the one before it in slot 2 (for Switch)
  give(id) {
    const g = G.Game, p = g.player;
    if (id === "melee") { g.switchSlot(0); return; }
    const prev = this.cur && this.cur !== id ? this.cur : (id === "pistol" ? "smg" : "pistol");
    [id, prev].forEach((w) => {
      const d = G.WEAPON_DEFS[w];
      if (!p.ammo[w]) p.ammo[w] = { mag: d.magSize, reserve: d.magSize * 6 };
      if (!p.weaponLevels[w]) p.weaponLevels[w] = { dmg: 1, rate: 1, mag: 1 };
    });
    p.gunSlots = [id, prev];
    p.currentSlot = 1;
    if (g.wsm) g.wsm.requestSwitch();
    this.cur = id;
    // (the HUD's own frame redraws the slots and the touch buttons)
  },

  buildPanel() {
    const T = (k) => G.T(k), esc = (s) => G.escapeHtml(String(s));
    const st = document.createElement("style");
    st.textContent = `.wlab{position:fixed;right:8px;top:44px;z-index:8000;width:236px;max-height:calc(100vh - 220px);overflow:auto;
      background:rgba(10,14,12,.86);color:#e6efe8;border:1px solid #5E7A55;border-radius:4px;padding:10px;font:13px/1.35 system-ui,sans-serif}
      .wlab h3{margin:0 0 6px;font-size:14px;letter-spacing:.04em}.wlab select{width:100%;margin:2px 0 8px;font-size:13px;padding:4px}
      .wlab .row{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}.wlab button{flex:1 1 46%;min-height:32px;background:#1b2520;color:#e6efe8;
      border:1px solid #5E7A55;border-radius:3px;font-size:12px;cursor:pointer}.wlab button.on{background:#3d5a36;border-color:#9BC48A}
      .wlab small{display:block;color:#9aa5ad;margin-top:4px}.wlab #wlab-state{font:12px ui-monospace,Consolas,monospace;color:#9BC48A}
      .wlab-note{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9500;background:rgba(0,0,0,.8);color:#fff;padding:12px 18px;border-radius:4px;font:14px system-ui}`;
    document.head.appendChild(st);
    // every gun, by family
    const fams = {};
    Object.values(G.WEAPON_DEFS).forEach((d) => { const f = G.ViewModel.family(d); (fams[f] = fams[f] || []).push(d); });
    const order = ["pistol", "revolver", "smg", "rifle", "shotgun_pump", "shotgun_semi", "sniper_bolt", "lmg", "special"];
    const opts = order.filter((f) => fams[f]).map((f) => `<optgroup label="${esc(T("family." + f))}">${fams[f].map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</optgroup>`).join("")
      + `<optgroup label="${esc(T("family.knife"))}"><option value="melee">${esc(G.MELEE_DEF.name || T("family.knife"))}</option></optgroup>`;
    const el = document.createElement("div");
    el.className = "wlab";
    el.innerHTML = `<h3>${esc(T("lab.title"))}</h3><div id="wlab-state"></div>
      <label>${esc(T("lab.weapon"))}<select id="wlab-gun">${opts}</select></label>
      <div class="row"><button data-a="fire">${esc(T("lab.fire"))}</button><button data-t="hold">${esc(T("lab.hold"))}</button></div>
      <div class="row"><button data-a="tac">${esc(T("lab.reloadTac"))}</button><button data-a="empty">${esc(T("lab.reloadEmpty"))}</button></div>
      <div class="row"><button data-a="switch">${esc(T("lab.switch"))}</button><button data-a="inspect">${esc(T("lab.inspect"))}</button></div>
      <div class="row"><button data-t="aim">${esc(T("lab.aim"))}</button><button data-a="lower">${esc(T("lab.lower"))}</button><button data-t="run">${esc(T("lab.run"))}</button></div>
      <div class="row"><span style="flex:1 1 100%">${esc(T("lab.speed"))}</span>${[1, 0.5, 0.25, 0.1].map((v) => `<button data-s="${v}" class="${v === 1 ? "on" : ""}">×${v}</button>`).join("")}</div>
      <div class="row"><button data-t="endless" class="on">${esc(T("lab.ammo"))}</button></div>
      <small>${esc(T("lab.help"))}</small>`;
    document.body.appendChild(el);
    this.panel = el;
    const sel = el.querySelector("#wlab-gun");
    sel.value = this.cur;
    sel.onchange = () => { this.give(sel.value); sel.blur(); };
    el.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        const g = G.Game, id = g.currentWeaponId();
        if (b.dataset.t) { this[b.dataset.t] = !this[b.dataset.t]; b.classList.toggle("on", this[b.dataset.t]); if (!this.hold) G.Input.mouseDown = false; if (!this.aim) G.Input.aimDown = false;
          if (b.dataset.t === "run" && !this.run) { const kb = G.save.settings.keybinds; G.Input.keys[kb.sprint] = false; G.Input.keys[kb.forward] = false; } }
        if (b.dataset.s) { this.speed = +b.dataset.s; el.querySelectorAll("[data-s]").forEach((x) => x.classList.toggle("on", x === b)); }
        const a = b.dataset.a, ammo = g.player.ammo[id];
        if (a === "fire") G.onFirePress();
        if (a === "tac" && ammo) { const size = Math.round(G.WEAPON_DEFS[id].magSize * g.player.weaponLevels[id].mag); ammo.mag = Math.max(1, Math.floor(size / 2)); g.reload(); }
        if (a === "empty" && ammo) { ammo.mag = 0; g.reload(); }
        if (a === "switch") g.switchSlot(g.player.currentSlot === 1 ? 2 : 1);
        if (a === "inspect") g.inspect();
        if (a === "lower" && g.wsm) g.wsm.setLowered("use", true, 1.2);
        b.blur();
      };
    });
  },
};

G.WeaponLab.start();
