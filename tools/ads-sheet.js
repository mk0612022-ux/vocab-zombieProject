// Dev-only (not shipped). The expansion's round 5: every optic on every family
// that takes it, aimed, one picture each, on one sheet -- the gun (the
// family's reference gun when it takes the optic), its reticle on the middle
// of the view, a magnified scope's ring drawn in as the HUD draws it over the
// view. tools/round34-test.js checks the same by numbers for every gun.
// Load it into the game (in the lobby), then:
//   const url = await G.AdsSheet.run({ w: 480, h: 270 })   a JPEG data URL
window.G = window.G || {};
G.AdsSheet = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // an element of SVG as an image the size of a cell
  function svgImage(svg, w, h) {
    const c = svg.cloneNode(true);
    c.setAttribute("width", w); c.setAttribute("height", h); c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const img = new Image();
    return new Promise((res) => { img.onload = () => res(img); img.onerror = () => res(null); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(c.outerHTML); });
  }
  // the skins: each gun in the hands, from the hip, in each skin -- its accent
  // and its glowing sights the same in all of them
  //   const url = await G.AdsSheet.skins({ guns: ["scrap_spitter", "pistol"], skins: [...] })
  async function skins(o) {
    o = o || {};
    o.combos = [];
    (o.guns || ["scrap_spitter", "void_principal", "shotgun"]).forEach((id) => (o.skins || ["factory", "blackSteel", "woodSteel", "blackFde", "silverBlack", "odBlack", "whiteBlack", "gunmetalBrown", "darkLens", "lexicon", "scholarGold", "level1", "level2", "level3", "camo_health", "camo_technology"])
      .forEach((sk) => o.combos.push({ d: G.WEAPON_DEFS[id], L: sk === "factory" ? {} : { skin: sk }, aim: false, label: () => G.WEAPON_DEFS[id].name + " · " + G.Attach.skinName(sk) })));
    return run(o);
  }
  async function run(o) {
    o = o || {};
    const W = o.w || 480, H = o.h || 270, g = G.Game, A = G.Attach, I = G.Input;
    const real = g._update0 || g.update, spawn0 = G.Spawner.update, lock0 = I.requestPointerLock;
    const step = (n) => { for (let i = 0; i < n; i++) real.call(g, 1 / 60); };
    I.requestPointerLock = () => {};
    if (G.MainMenu && G.MainMenu.visible()) { G.MainMenu.toLobby(); await wait(600); }
    if (G.Modal.isOpen("brightness") && G.BrightnessCal) G.BrightnessCal.ok();
    g.startLevel(o.level || 1);
    for (let i = 0; i < 200 && !(g.state === "GAMEPLAY" && g.wsm); i++) await wait(100);
    G.Spawner.update = () => {};
    g.update = () => {};
    G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
    g.player.hp = g.player.maxHp = 1e6; g.requiredKills = 1e9; g.clearZombies();
    if (G.Tutorial && G.Tutorial.current) G.Tutorial.skip();
    if (o.look) { g.yawObject.rotation.y = o.look; }
    const hud = document.getElementById("hud");
    const combos = o.combos || [];
    if (!o.combos) Object.keys(G.ATTACH_FAMILIES).forEach((f) => {
      const guns = Object.values(G.WEAPON_DEFS).filter((d) => A.familyOf(d) === f);
      const flag = new Set(Object.values(G.GunRef.FLAGSHIP || {})), ref = guns.filter((d) => flag.has(d.id));
      const opts = [];
      guns.forEach((d) => A.allowed(d, "optic").forEach((x) => { if (!opts.includes(x)) opts.push(x); }));
      opts.forEach((op) => {
        const d = ref.find((x) => A.allowed(x, "optic").includes(op)) || guns.find((x) => A.allowed(x, "optic").includes(op));
        combos.push({ d, L: { optic: op }, aim: true, label: () => G.T("family." + f) + " · " + d.name + " · " + G.T("att." + op + ".name") });
      });
    });
    const cols = o.cols || 5, rows = Math.ceil(combos.length / cols), LH = 24;
    const sheet = document.createElement("canvas");
    sheet.width = cols * W; sheet.height = rows * (H + LH);
    const cx = sheet.getContext("2d");
    cx.fillStyle = "#111"; cx.fillRect(0, 0, sheet.width, sheet.height);
    cx.font = "15px sans-serif";
    const out = [];
    for (let i = 0; i < combos.length; i++) {
      const c = combos[i], x = (i % cols) * W, y = Math.floor(i / cols) * (H + LH);
      A.preview = { [c.d.id]: c.L }; A.apply();
      const p = g.player, d = c.d;
      if (!p.weaponLevels[d.id]) p.weaponLevels[d.id] = { dmg: 1, rate: 1, mag: 1 };
      p.ammo[d.id] = { mag: d.magSize, reserve: 100 };
      p.gunSlots = [d.id]; p.currentSlot = 1;
      g.wsm.requestSwitch(); g.wsm.finishSwitch();
      g.buildWeaponViewModel(d.id);
      I.aimDown = !!c.aim; g.aimP = c.aim ? 1 : 0;
      step(c.aim ? 4 : 24);
      g.renderFrame();
      cx.drawImage(g.renderer.domElement, x, y, W, H);
      const hs = document.getElementById("hud-scope");
      if (hs && !hs.classList.contains("hidden") && hs.querySelector("svg")) { const img = await svgImage(hs.querySelector("svg"), W, H); if (img) cx.drawImage(img, x, y, W, H); }
      // the middle of the view, for the eye
      // (four ticks round it with a gap: the reticle shows through)
      if (c.aim) {
        const mx = x + W / 2, my = y + H / 2, a = 7, b = 16;
        cx.strokeStyle = "rgba(0,255,120,0.7)"; cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(mx - b, my); cx.lineTo(mx - a, my); cx.moveTo(mx + a, my); cx.lineTo(mx + b, my);
        cx.moveTo(mx, my - b); cx.lineTo(mx, my - a); cx.moveTo(mx, my + a); cx.lineTo(mx, my + b); cx.stroke();
      }
      cx.fillStyle = "#e8f0ea";
      cx.fillText(c.label(), x + 6, y + H + 17);
      out.push(c.label());
      I.aimDown = false; g.aimP = 0; step(1);
      await wait(0);
    }
    A.preview = null; A.apply();
    G.Spawner.update = spawn0; g.update = real; I.requestPointerLock = lock0;
    g.quitToMainMenu();
    window._adsSheetList = out;
    if (hud) hud.classList.toggle("hidden", g.state !== "GAMEPLAY");
    return sheet.toDataURL("image/jpeg", 0.86);
  }
  // each gun on its own from the side, lit like a photograph: the skins and the
  // attachments' models as they are (o.combos: [{ d, L, label }]; or o.guns x o.skins)
  async function side(o) {
    o = o || {};
    const W = o.w || 400, H = o.h || 225, g = G.Game, A = G.Attach, r = g.renderer, LH = 24;
    let combos = o.combos;
    if (!combos) {
      combos = [];
      (o.guns || ["scrap_spitter", "void_principal", "shotgun"]).forEach((id) => (o.skins || Object.keys(G.GUN_SKINS)).forEach((sk) => combos.push({ d: G.WEAPON_DEFS[id], L: sk === "factory" ? {} : { skin: sk }, label: () => G.WEAPON_DEFS[id].name + " · " + A.skinName(sk) })));
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x24292a);
    scene.add(new THREE.HemisphereLight(0xe8eeff, 0x3a3430, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 4, 2); scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8d6ff, 0.6); fill.position.set(2, -1, -3); scene.add(fill);
    const cam = new THREE.PerspectiveCamera(24, r.domElement.width / r.domElement.height, 0.02, 30);
    const cols = o.cols || 4, rows = Math.ceil(combos.length / cols);
    const sheet = document.createElement("canvas");
    sheet.width = cols * W; sheet.height = rows * (H + LH);
    const cx = sheet.getContext("2d");
    cx.fillStyle = "#111"; cx.fillRect(0, 0, sheet.width, sheet.height); cx.font = "14px sans-serif";
    for (let i = 0; i < combos.length; i++) {
      const c = combos[i], x = (i % cols) * W, y = Math.floor(i / cols) * (H + LH);
      A.preview = { [c.d.id]: c.L }; A.apply();
      const m = G.buildWeaponMesh(c.d, { loadout: true });
      scene.add(m); m.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(m), mid = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
      const half = Math.max(size.z / cam.aspect, size.y) / 2 * 1.25, dist = half / Math.tan(cam.fov * Math.PI / 360);
      cam.position.set(mid.x + dist, mid.y + dist * 0.18, mid.z - dist * 0.08); cam.lookAt(mid);
      r.setRenderTarget(null);
      r.render(scene, cam);
      cx.drawImage(r.domElement, x, y, W, H);
      cx.fillStyle = "#e8f0ea"; cx.fillText(c.label(), x + 6, y + H + 16);
      scene.remove(m); G.disposeObject3D(m);
      await wait(0);
    }
    A.preview = null; A.apply();
    return sheet.toDataURL("image/jpeg", 0.88);
  }
  return { run, skins, side };
})();
