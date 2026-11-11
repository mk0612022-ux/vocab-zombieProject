// ===================================================================
// Attachments, skins and what unlocks them (expansion, round 5)
// -------------------------------------------------------------------
// The tables are js/data/attachments.js. A player picks, in the Armory, what
// each gun carries (or a default for its family) and its skin; the gun wears
// them whenever it comes to hand. Every attachment is a sidegrade.
//
//   G.Attach.loadoutOf(def)    { optic, muzzle, mag, grip, skin } as worn now
//   G.Attach.mods(def)         what they do together (multipliers, flags)
//   G.Attach.apply()           the guns' numbers brought up to date (their
//                              magazine and reload on G.WEAPON_DEFS, the rest
//                              through G.GunStats) -- after any change
//   G.Attach.set(id, slot, v)  put one on (or null: off); setSkin; setFamily
//   G.Attach.decorate(g, def)  the gun in the hands: the attachments' models
//                              on its rail, muzzle, magazine and under the
//                              barrel (its iron sights make way for an optic),
//                              the optic's reticle, where it is aimed, its
//                              skin (js/gunskins.js)
//   G.Attach.aimFov / sway / laser / magnified   in play: the optic's zoom,
//                              the drift when aimed, the laser's dot, a
//                              scope's ring
//   G.Attach.suppressBuffer    a shot's buffer as it sounds through a suppressor
//   G.Attach.check()           what learning has unlocked (reads the learning
//                              record, never writes it); a toast for new ones
//   G.Attach.openEditor(def)   the Armory's window for one gun
//
// The save: G.save.attach = { v, unlocked: {id: day}, loadout: {gunId:
// {slot: id, skin}}, family: {fam: {...}}, forms: {entryId: [forms]},
// spellBest, bossesBest }. Off (G.CONFIG.expansion.attachments = false):
// no gun wears anything, nothing is unlocked anew, the save keeps its choices.
// ===================================================================
window.G = window.G || {};

G.Attach = (function () {
  const on = () => !(G.CONFIG.expansion && G.CONFIG.expansion.attachments === false);
  const C = () => G.CONFIG.attach;
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const db = (d) => Math.pow(10, d / 20);
  const SLOTS = () => G.ATTACH_SLOTS;
  let modCache = {};

  // ---------------- the save ----------------
  const obj = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});
  const known = (id) => !!(G.ATTACHMENTS[id] || (String(id).indexOf("skin:") === 0 && G.GUN_SKINS[String(id).slice(5)]));
  // one choice: each slot's attachment (of that slot), the skin
  function pick(o) {
    const x = {};
    SLOTS().forEach((s) => { const v = obj(o)[s]; if (typeof v === "string" && G.ATTACHMENTS[v] && G.ATTACHMENTS[v].slot === s) x[s] = v; });
    const sk = obj(o).skin;
    if (typeof sk === "string" && G.GUN_SKINS[sk] && sk !== "factory") x.skin = sk;
    return x;
  }
  function normalize(raw) {
    const r = obj(raw), out = { v: 1, unlocked: {}, loadout: {}, family: {}, forms: {}, spellBest: 0, bossesBest: 0 };
    Object.keys(obj(r.unlocked)).forEach((k) => { if (known(k)) out.unlocked[k] = Math.max(0, Math.floor(Number(r.unlocked[k]) || 0)); });
    Object.keys(obj(r.loadout)).forEach((id) => { if (G.WEAPON_DEFS && G.WEAPON_DEFS[id]) out.loadout[id] = pick(r.loadout[id]); });
    Object.keys(obj(r.family)).forEach((f) => { if (G.ATTACH_FAMILIES[f]) out.family[f] = pick(r.family[f]); });
    Object.keys(obj(r.forms)).slice(0, 5000).forEach((k) => { const a = r.forms[k]; if (Array.isArray(a)) out.forms[k] = a.filter((w) => typeof w === "string" && w.length < 40).slice(0, 16); });
    out.spellBest = Math.max(0, Math.min(1e7, Math.floor(Number(r.spellBest) || 0)));
    out.bossesBest = Math.max(0, Math.min(99, Math.floor(Number(r.bossesBest) || 0)));
    return out;
  }
  function data() {
    if (!G.save) return normalize(null);
    if (!G.save.attach || G.save.attach.v !== 1) G.save.attach = normalize(G.save.attach);
    return G.save.attach;
  }

  // ---------------- what a gun can have on ----------------
  const familyOf = (def) => (G.ViewModel ? G.ViewModel.family(def) : "rifle");
  // a gun with its own scope: one on its model, or a zoom of its own that the
  // game draws a scope's ring for (the peep and the .50's frame are iron
  // sights looked through zoomed: an optic can take their place)
  function ownScope(def) {
    if (!def) return false;
    const I = G.GunRef && G.GunRef.info(def);
    if (I && /scope/i.test(I.sight || "")) return true;
    const iron = !!I && (I.sight === "peep" || I.sight === "frameU");
    return !!def.scope && !iron;
  }
  function allowed(def, slot) {
    if (!def || def.id === "melee") return [];
    if (slot === "optic" && ownScope(def)) return [];
    return ((G.ATTACH_FAMILIES[familyOf(def)] || {})[slot] || []).slice();
  }
  function unlocked(id) {
    if (!id) return true;
    if (String(id).indexOf("skin:") === 0) { const s = G.GUN_SKINS[id.slice(5)]; return !!s && (!!s.base || !!data().unlocked[id]); }
    return G.ATTACH_FREE.includes(id) || !!data().unlocked[id];
  }
  // (the Weapon Lab's and the checks' own choices: anything that fits, locked
  // or not, never saved -- G.Attach.preview = { gunId: { slot: id, skin } })
  let preview = null;
  // as chosen (the gun's own choice, else its family's), what can be worn of it
  function loadoutOf(def) {
    if (!on() || !def || def.id === "melee" || !G.WEAPON_DEFS[def.id]) return {};
    if (preview && preview[def.id]) {
      const P = preview[def.id], out = {};
      SLOTS().forEach((s) => { if (P[s] && allowed(def, s).includes(P[s])) out[s] = P[s]; });
      if (P.skin && G.GUN_SKINS[P.skin] && P.skin !== "factory") out.skin = P.skin;
      return out;
    }
    const D = data(), own = D.loadout[def.id], fam = D.family[familyOf(def)] || {}, src = own || fam, out = {};
    SLOTS().forEach((s) => { const v = src[s]; if (v && allowed(def, s).includes(v) && unlocked(v)) out[s] = v; });
    const sk = src.skin;
    if (sk && G.GUN_SKINS[sk] && unlocked("skin:" + sk)) out.skin = sk;
    return out;
  }
  const sig = (L) => SLOTS().map((s) => L[s] || "").join(",");
  // what a list of attachments does together: multipliers at 1, flags off,
  // unless one of them says otherwise (the balance report uses it on its own)
  function combine(list) {
    const M = { zoom: 1, ads: 1, sway: 1, range: 1, recoilV: 1, recoilH: 1, mag: 1, reload: 1, hip: 1, loud: 0, flash: 1, sound: null, laser: false, optic: null, list: list.slice() };
    list.forEach((id) => {
      const a = G.ATTACHMENTS[id];
      if (!a) return;
      ["zoom", "ads", "sway", "range", "recoilV", "recoilH", "mag", "reload", "hip", "flash"].forEach((k) => { if (a[k] != null) M[k] *= a[k]; });
      if (a.loud) M.loud += a.loud;
      if (a.sound) M.sound = a.sound;
      if (a.laser) M.laser = true;
      if (a.slot === "optic") M.optic = id;
    });
    return M;
  }
  const NONE = combine([]);
  function mods(def) {
    if (!on() || !def || def.id === "melee") return NONE;
    const L = loadoutOf(def), key = def.id + ":" + sig(L);
    return modCache[key] || (modCache[key] = combine(SLOTS().map((s) => L[s]).filter(Boolean)));
  }
  // the guns' numbers: magazine and reload on the defs (from what the sheet
  // set: attachBase), the rest through G.GunStats (its sheets built again)
  function apply() {
    modCache = {};
    Object.values(G.WEAPON_DEFS || {}).forEach((d) => {
      if (!d.attachBase) d.attachBase = { magSize: d.magSize, reloadTime: d.reloadTime };
      const M = mods(d), B = d.attachBase;
      d.magSize = Math.max(1, Math.round(B.magSize * M.mag));
      d.reloadTime = Math.round(B.reloadTime * M.reload);
    });
    if (G.GunStats) G.GunStats.reset();
    // (a magazine that shrank: what no longer fits goes back to the reserve)
    const g = G.Game, pl = g && g.player;
    if (pl && pl.ammo) Object.keys(pl.ammo).forEach((id) => {
      const d = G.WEAPON_DEFS[id], a = pl.ammo[id], l = pl.weaponLevels && pl.weaponLevels[id];
      if (!d || !a) return;
      const size = Math.round(d.magSize * ((l && l.mag) || 1));
      if (a.mag > size) { a.reserve += a.mag - size; a.mag = size; }
    });
  }
  // between runs always; in a run only in the shop (G.CONFIG.attach.changeInShop)
  function editable() {
    const st = G.Game && G.Game.state;
    if (st === "SHOP") return !!C().changeInShop;
    return st !== "GAMEPLAY" && st !== "PAUSE";
  }
  function ownOf(def) {
    const D = data();
    return D.loadout[def.id] || (D.loadout[def.id] = Object.assign({}, D.family[familyOf(def)] || {}));
  }
  function set(id, slot, value) {
    const def = G.WEAPON_DEFS[id];
    if (!def || !SLOTS().includes(slot)) return false;
    if (value && (!allowed(def, slot).includes(value) || !unlocked(value))) return false;
    const L = ownOf(def);
    if (value) L[slot] = value; else delete L[slot];
    changed();
    return true;
  }
  function setSkin(id, skin) {
    const def = G.WEAPON_DEFS[id];
    if (!def || (skin && (!G.GUN_SKINS[skin] || !unlocked("skin:" + skin)))) return false;
    const L = ownOf(def);
    if (skin && skin !== "factory") L.skin = skin; else delete L.skin;
    changed();
    return true;
  }
  // a whole choice for one gun at once (the Armory's window), or for its family
  function setAll(id, L, forFamily) {
    const def = G.WEAPON_DEFS[id];
    if (!def) return false;
    const D = data(), x = pick(L);
    SLOTS().forEach((s) => { if (x[s] && (!allowed(def, s).includes(x[s]) || !unlocked(x[s]))) delete x[s]; });
    if (x.skin && !unlocked("skin:" + x.skin)) delete x.skin;
    if (forFamily) { D.family[familyOf(def)] = x; delete D.loadout[id]; } else D.loadout[id] = x;
    changed();
    return true;
  }
  function setFamily(fam, L) {
    if (!G.ATTACH_FAMILIES[fam]) return false;
    data().family[fam] = pick(L);
    changed();
    return true;
  }
  function changed() {
    apply();
    if (G.persist) G.persist();
    const g = G.Game;
    // (the gun in the hands wears it now: built again; a suppressor's shots drawn now)
    if (g && g.camera && g.weaponViewGroup && g.wsm && g.wsm.held && g.wsm.held !== "melee" && !(g._quick && g._quick.gun)) g.buildWeaponViewModel();
    if (G.GunAudio && G.GunAudio.refit && g && g.player) G.GunAudio.refit(g.player.gunSlots || []);
  }

  // ---------------- the models ----------------
  // HD-blocky in the guns' own dark shades; only the reticles glow
  const SHADE = { body: 0x17181a, lit: 0x2b2d30, deep: 0x0b0c0d, metal: 0x3a3d40, glass: 0x1d2a33, shell: 0x8c2e32, brass: 0xcebb75 };
  let reticles = null;
  function reticle(kind) {
    if (!reticles) {
      reticles = {};
      const make = (draw) => {
        const c = document.createElement("canvas"); c.width = c.height = 64;
        draw(c.getContext("2d"));
        const t = new THREE.CanvasTexture(c);
        const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide });
        m.userData.shared = true; m.userData.reticle = kind;
        return m;
      };
      // the red dot: a dot
      reticles.dot = make((x) => { x.fillStyle = "#ff2a2a"; x.beginPath(); x.arc(32, 32, 4.2, 0, Math.PI * 2); x.fill(); });
      // the holographic: a circle and a dot
      reticles.holo = make((x) => {
        x.strokeStyle = "#ff3b3b"; x.lineWidth = 2.4; x.beginPath(); x.arc(32, 32, 17, 0, Math.PI * 2); x.stroke();
        x.fillStyle = "#ff3b3b"; x.beginPath(); x.arc(32, 32, 2.6, 0, Math.PI * 2); x.fill();
      });
      // a scope's eyepiece: dark round the octagon of its tube, a fine cross, a dot
      reticles.scope = make((x) => {
        x.fillStyle = "rgba(4,5,6,0.95)"; x.fillRect(0, 0, 64, 64);
        x.globalCompositeOperation = "destination-out";
        x.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4; x.lineTo(32 + Math.cos(a) * 29, 32 + Math.sin(a) * 29); }
        x.closePath(); x.fill();
        x.globalCompositeOperation = "source-over";
        x.strokeStyle = "rgba(10,10,10,0.95)"; x.lineWidth = 1;
        x.beginPath(); x.moveTo(4, 32); x.lineTo(60, 32); x.moveTo(32, 4); x.lineTo(32, 60); x.stroke();
        x.fillStyle = "#ff3b3b"; x.beginPath(); x.arc(32, 32, 1.6, 0, Math.PI * 2); x.fill();
      });
    }
    return reticles[kind];
  }
  // the top of a gun to fix an optic on: its rail, else just under its sights
  function rail(g) {
    const An = g.userData.anchors || {}, aim = g.userData.aim;
    if (An.rail) return An.rail;
    if (aim && aim.y != null) return new THREE.Vector3(0, aim.y - 0.014, (aim.z || 0) - 0.07);
    return new THREE.Vector3(0, 0.07, 0);
  }
  // where a gun is held aimed through an optic: tuned in the Weapon Lab (this
  // browser, while tuning), else the table's (js/data/attachments.js), else null
  function adsFor(id, optic) {
    const k = id + ":" + optic;
    try { const own = JSON.parse(localStorage.getItem("vz-ads-tune") || "{}"); if (own && own[k]) return own[k]; } catch (e) { /* none kept */ }
    return G.ATTACH_ADS[k] || null;
  }
  // the highest point of the gun (as it is: hidden things and attachments
  // left out) in the narrow band the line of sight runs along, x = 0, in
  // front of the eye (at zEye: +z is towards the player)
  function topOnLine(g, zEye) {
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), bb = new THREE.Box3(), half = C().clearBand;
    const seen = (o) => { for (let p = o; p && p !== g; p = p.parent) if (p.visible === false) return false; return true; };
    let top = -Infinity;
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry || !seen(o) || (o.material && o.material.userData && o.material.userData.role === "attach")) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      if (bb.min.x > half || bb.max.x < -half || bb.min.z > zEye) return;
      top = Math.max(top, bb.max.y);
    });
    return top;
  }
  function decorate(g, def) {
    if (!on() || !g || !def || def.id === "melee") return g;
    const L = loadoutOf(def);
    g.userData.loadout = L;
    if (!Object.keys(L).length) return g;
    const An = g.userData.anchors = g.userData.anchors || {};
    const parts = g.userData.parts || {};
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const mats = {};
    const mat = (hex, skin) => { const k = hex + ":" + skin; if (!mats[k]) { mats[k] = G.makeBoxMat(hex); mats[k].userData.skin = skin; mats[k].userData.role = "attach"; } return mats[k]; };
    // a box at gun coordinates, inside part P (its offset taken off) or the gun
    const box = (w, h, d, x, y, z, m, P, rx, rz) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      const o = P ? P.position : null;
      b.position.set(x - (o ? o.x : 0), y - (o ? o.y : 0), z - (o ? o.z : 0));
      if (rx) b.rotation.x = rx;
      if (rz) b.rotation.z = rz;
      (P || g).add(b);
      return b;
    };
    const plane = (size, x, y, z, m, P) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
      const o = P ? P.position : null;
      p.position.set(x - (o ? o.x : 0), y - (o ? o.y : 0), z - (o ? o.z : 0));
      p.renderOrder = 3;
      (P || g).add(p);
      return p;
    };
    // a stepped octagon along z (a tube), as the guns' own barrels and scopes
    const oct = (r, len, x, y, z, m, P) => { box(r * 2, r * 0.83, len, x, y, z, m, P); box(r * 0.83, r * 2, len, x, y, z, m, P); box(r * 1.42, r * 1.42, len, x, y, z, m, P); };
    const M = mat(SHADE.body, "matte"), D = mat(SHADE.deep, "matte"), S = mat(SHADE.metal, "bare");

    // ---- the optic, on the rail; the iron sights make way ----
    if (L.optic && !g.userData.scoped) {
      const drop = [];
      g.traverse((o) => { if (o.userData && o.userData.sight) drop.push(o); });
      drop.forEach((o) => { if (o.parent) o.parent.remove(o); if (o.geometry) o.geometry.dispose(); });
      const a = G.ATTACHMENTS[L.optic].model, R = rail(g), P = parts[g.userData.railPart] || null;
      // where it is aimed: the optic's middle on the line of the view, its back
      // `eye` from the eye (a red dot or a holo no nearer than the gun's own
      // sights were, a scope at its eye relief)
      const own = g.userData.aim, eye = a.kind === "scope" ? a.eye : Math.max(a.eye, ((own && own.eye) || a.eye) * 0.85);
      // (a gun with something standing up into the line through the window in
      // front of the eye -- the launcher's fat barrel: the optic goes up on a
      // riser till it clears)
      const lift = Math.max(0, topOnLine(g, R.z + a.len / 2 + eye) + C().clear - (R.y + a.h));
      const y = R.y + lift, z = R.z, cy = y + a.h;
      if (lift > 0.002) box(0.022, lift, Math.max(0.04, a.len * 0.6), 0, R.y + lift / 2, z, D, P);   // the riser
      box(0.026, 0.01, Math.max(0.04, a.len * 0.7), 0, y + 0.005, z, D, P);                         // the mount
      let lens;
      if (a.kind === "dot") {
        box(0.03, 0.012, a.len, 0, y + 0.014, z, M, P);
        [-1, 1].forEach((s) => box(0.005, 0.034, 0.012, s * 0.016, cy, z - a.len * 0.35, M, P));     // the hood
        box(0.037, 0.005, 0.012, 0, cy + 0.017, z - a.len * 0.35, M, P);
        lens = plane(0.026, 0, cy, z - a.len * 0.35 + 0.004, reticle("dot"), P);
      } else if (a.kind === "holo") {
        box(0.04, 0.016, a.len, 0, y + 0.016, z, M, P);
        [-1, 1].forEach((s) => box(0.005, 0.04, a.len * 0.75, s * 0.022, cy, z, M, P));
        box(0.048, 0.006, a.len * 0.75, 0, cy + 0.021, z, M, P);
        box(0.012, 0.012, 0.02, 0.018, y + 0.016, z + a.len * 0.42, S, P);                          // its buttons
        lens = plane(0.036, 0, cy, z + a.len * 0.3, reticle("holo"), P);
      } else {
        // a scope: the octagonal tube, its bell, the eyepiece, two rings, a turret
        oct(a.r, a.len, 0, cy, z, M, P);
        oct(a.bell, 0.03, 0, cy, z - a.len / 2 + 0.015, M, P);
        oct(a.r * 1.18, 0.03, 0, cy, z + a.len / 2 - 0.015, M, P);
        [-1, 1].forEach((s) => box(0.012, a.h - 0.004, 0.012, 0, y + (a.h - 0.004) / 2, z + s * a.len * 0.25, D, P));
        box(0.012, 0.016, 0.012, 0, cy + a.r + 0.007, z, S, P);
        const glass = new THREE.MeshBasicMaterial({ color: SHADE.glass, transparent: true, opacity: 0.55, depthWrite: false });
        plane(a.bell * 1.5, 0, cy, z - a.len / 2 - 0.001, glass, P);
        lens = plane(a.r * 2.1, 0, cy, z + a.len / 2 + 0.002, reticle("scope"), P);
      }
      lens.userData.lens = a.kind;
      g.userData.aim = adsFor(def.id, L.optic) || { y: cy, z: z + a.len / 2, eye };
      g.userData.optic = L.optic;
    }

    // ---- the muzzle: the device goes on (back over the barrel's end a little,
    // so no gap shows), the muzzle moves out to its end ----
    if (L.muzzle && An.muzzle) {
      const a = G.ATTACHMENTS[L.muzzle].model, m = An.muzzle, bore = g.userData.bore || 0.024, ov = 0.012;
      const r = Math.max(0.03, Math.min(bore + 0.03, bore * a.r)) / 2, z0 = m.z + ov - a.len / 2;
      if (a.kind === "can") {
        oct(r, a.len, m.x, m.y, z0, M);
        box(r * 1.6, r * 0.5, 0.012, m.x, m.y + r * 0.95, m.z + ov - a.len * 0.2, S);              // a band of its maker's
        oct(r * 0.55, 0.006, m.x, m.y, m.z + ov - a.len - 0.002, D);
      } else if (a.kind === "comp") {
        box(r * 2, r * 2, a.len, m.x, m.y, z0, M);
        [0, 1].forEach((i) => box(r * 0.7, 0.006, 0.012, m.x, m.y + r, z0 - 0.012 + i * 0.022, D));  // ports on top
      } else {
        box(r * 2.4, r * 1.8, a.len, m.x, m.y, z0, S);
        [-1, 1].forEach((s) => [0, 1].forEach((i) => box(0.004, r * 1.3, 0.012, m.x + s * r * 1.2, m.y, z0 - 0.016 + i * 0.026, D)));   // side ports
      }
      An.muzzle = m.clone().add(V(0, 0, ov - a.len));
    }

    // ---- the magazine (on its own part, so a reload carries it) ----
    if (L.mag) {
      const a = G.ATTACHMENTS[L.mag].model, P = parts.mag || null;
      if (g.userData.magKind === "tube" || !P) {
        // a tube under the barrel: a shell holder on the left of the receiver
        const sd = An.side || V(-0.06, 0, 0.02);
        box(0.006, 0.05, 0.12, sd.x - 0.003, sd.y, sd.z, M);
        for (let i = 0; i < 5; i++) {
          box(0.014, 0.04, 0.014, sd.x - 0.013, sd.y + 0.004, sd.z - 0.048 + i * 0.024, mat(SHADE.shell, "polymer"));
          box(0.0146, 0.01, 0.0146, sd.x - 0.013, sd.y - 0.019, sd.z - 0.048 + i * 0.024, mat(SHADE.brass, "bare"));
        }
      } else {
        const w = An.magWell || P.position, b = An.magBottom || P.position.clone().add(V(0, -0.12, 0));
        const dir = b.clone().sub(w).normalize(), tilt = -Math.atan2(dir.z, -dir.y);
        // its size, from the magazine's own boxes
        g.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(P), sz = bb.getSize(V(0, 0, 0));
        const mw = Math.max(0.024, Math.min(0.08, sz.x * 0.96)), md = Math.max(0.04, Math.min(0.1, sz.z * 0.85));
        if (a.kind === "extended") {
          const c = b.clone().addScaledVector(dir, a.h / 2 - 0.006);
          box(mw, a.h, md, c.x, c.y, c.z, mat(SHADE.lit, "polymer"), P, tilt);
          const e = b.clone().addScaledVector(dir, a.h - 0.004);
          box(mw + 0.006, 0.012, md + 0.006, e.x, e.y, e.z, D, P, tilt);
          An.magBottom = b.clone().addScaledVector(dir, a.h);
          g.userData.magDepth = (g.userData.magDepth || 0.12) + a.h;
        } else if (g.userData.magKind === "short") {
          // a pistol's: a flared magazine well and a base plate with a pull tab
          box(mw * 1.5, 0.016, md * 1.25, b.x, b.y + 0.004, b.z, D, P, tilt);
          box(0.014, 0.02, 0.006, b.x, b.y - 0.01, b.z + md * 0.62, mat(SHADE.shell, "polymer"), P, tilt);
        } else {
          // a second magazine coupled beside the first, a clamp, a pull tab
          const len = Math.max(0.06, w.distanceTo(b) * 0.8), c = w.clone().addScaledVector(dir, len / 2 + 0.01);
          box(mw, len, md, c.x + mw + 0.004, c.y, c.z, mat(SHADE.lit, "polymer"), P, tilt);
          const k = w.clone().addScaledVector(dir, len * 0.7);
          box(mw * 2 + 0.012, 0.014, md * 0.5, k.x + mw / 2 + 0.002, k.y, k.z, D, P, tilt);
          box(0.012, 0.022, 0.006, b.x, b.y - 0.012, b.z + md / 2, mat(SHADE.shell, "polymer"), P, tilt);
        }
      }
    }

    // ---- under the barrel (a pistol's under its frame) ----
    // fixed on the underside over the support hand (`mount`), on the pump of a
    // pump gun (it slides with it); the hand then holds the grip
    if (L.grip && (An.fore || An.under)) {
      const a = G.ATTACHMENTS[L.grip].model, pistol = familyOf(def) === "pistol";
      const f = An.fore || An.under, bore = g.userData.bore || 0.024;
      const m = An.mount || f.clone().add(V(0, 0.02, 0)), P = parts[g.userData.gripPart] || null;
      const hold = (h) => { An.fore = h; if (P && An.pump) An.pump = h.clone(); };
      if (a.kind === "laser") {
        const u = pistol && An.under ? An.under.clone().add(V(0, -0.012, 0)) : V(bore * 1.25 + 0.012, m.y + 0.02, m.z - 0.04);
        box(pistol ? 0.024 : 0.02, 0.02, 0.05, u.x, u.y, u.z, M, P);
        box(0.01, 0.01, 0.004, u.x, u.y, u.z - 0.026, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), P);
        box(0.008, 0.006, 0.01, u.x + (pistol ? 0 : 0.011), u.y + (pistol ? -0.012 : 0.006), u.z + 0.012, S, P);   // its switch
        An.laser = V(u.x, u.y, u.z - 0.03);
      } else if (!pistol && a.kind === "vgrip") {
        box(0.03, 0.012, 0.05, m.x, m.y - 0.004, m.z, D, P);                                       // its clamp
        box(0.032, a.h, 0.036, m.x, m.y - 0.008 - a.h / 2, m.z, mat(SHADE.body, "grip"), P);
        hold(V(m.x, m.y - 0.008 - a.h * 0.55, m.z));
      } else if (!pistol) {
        box(0.03, 0.01, 0.06, m.x, m.y - 0.004, m.z, D, P);
        box(0.03, a.h, 0.07, m.x, m.y - 0.006 - a.h / 2, m.z - 0.012, mat(SHADE.body, "grip"), P, 0.55);
        hold(V(m.x, m.y - a.h * 0.45, m.z + 0.006));
      }
    }

    // ---- its skin (js/gunskins.js) ----
    if (L.skin && G.GunSkins) G.GunSkins.apply(g, L.skin, def);
    return g;
  }

  // ---------------- in play ----------------
  // the aimed field of view: a red dot or a holo a little closer than iron
  // sights, a scope by its magnification of the eye's own view
  function aimFov(def, game) {
    const base = def.scope || game.aimFov, M = mods(def);
    if (!M.optic) return base;
    const a = G.ATTACHMENTS[M.optic], rad = Math.PI / 180;
    const from = a.model.kind === "scope" ? game.baseFov : game.aimFov;
    return 2 * Math.atan(Math.tan((from * rad) / 2) / a.zoom) / rad;
  }
  // a magnified optic aimed: its ring ("oct": the low-poly octagon), else null
  const magnified = (def) => { const M = mods(def); return M.optic && G.ATTACHMENTS[M.optic].model.kind === "scope" ? "oct" : null; };
  // The view drifts a little aimed through an optic, more the stronger it is
  // (Reduce Motion: a third of it). On the camera's own turn, after the head
  // bob has set it this frame -- so the shots go where it drifts to
  let swayT = 0;
  function sway(game, dt, def) {
    const cam = game.camera;
    if (!cam) return;
    const M = mods(def), S = C().sway;
    swayT += dt;
    const red = G.Access && G.Access.reduce() ? S.reduced : 1;
    const k = M.optic ? (M.sway - 1) * S.amp * (game.aimT || 0) * red : 0;
    // (set from the head bob's own nod, never added to what is there: nothing builds up)
    const nod = G.HeadBob && G.HeadBob.off ? G.HeadBob.off.rx || 0 : 0;
    cam.rotation.x = nod + k * Math.sin(swayT * S.speed[0] * Math.PI * 2);
    cam.rotation.y = k * 0.8 * Math.sin(swayT * S.speed[1] * Math.PI * 2 + 1.3);
  }
  // the laser's dot: where the gun points from the hip, on a wall or a zombie
  let dot = null;
  const tmpO = new THREE.Vector3(), tmpD = new THREE.Vector3();
  function laser(game, def) {
    const show = on() && mods(def).laser && (game.aimT || 0) < 0.5 && game.state === "GAMEPLAY" && !!game.scene && !(game.wsm && game.wsm.mel);
    if (!show) { if (dot) dot.visible = false; return; }
    if (!dot || dot.parent !== game.scene) {
      if (!dot) {
        dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
        dot.userData.laserDot = true;
      }
      game.scene.add(dot);
    }
    game.camera.getWorldPosition(tmpO); game.camera.getWorldDirection(tmpD);
    const range = C().laserRange, far = game.wallDistance ? game.wallDistance(tmpO, tmpD, range) : range;
    const near = (game.zombies || []).filter((z) => z.alive && z.mesh && z.mesh.position.distanceToSquared(tmpO) < far * far + 4);
    const hit = near.length && G.Aim ? G.Aim.trace(game, tmpO, tmpD, far, near)[0] : null;
    const d = hit ? hit.distance : far;
    dot.visible = d < range - 0.01;
    dot.position.copy(tmpO).addScaledVector(tmpD, Math.max(0.3, d - 0.03));
  }
  const suppressed = (def) => mods(def).sound === "suppressed";
  const flash = (def) => mods(def).flash;
  const loud = (def) => mods(def).loud;

  // ---------------- the suppressed family (section 5.3) ----------------
  // From the gun's own shot, so both its sound paths (js/gunvoice.js, the
  // older layers) go through it alike: the crack band-passed to 800-2000 Hz
  // and down 12 dB (its peak), a short dull body (a sine 200 -> 120 Hz), the
  // tail cut by 20 dB within 0.2 s and no far echo (js/gunaudio.js leaves
  // those out), and the action's own sound (`mech`: the gun's mechanical layer
  // drawn alone) down only 6 dB -- so it stands out 6 dB more against the
  // shot than it did. A sniper (optional) keeps a faint supersonic crack.
  function biquad(x, sr, type, f0, q) {
    const w = 2 * Math.PI * f0 / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    const lp = type === "lp", b0 = lp ? (1 - cs) / 2 : (1 + cs) / 2, b1 = lp ? 1 - cs : -(1 + cs), b2 = b0;
    const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  const peakOf = (a, from, to) => { let m = 0; for (let i = from || 0; i < (to || a.length); i++) { const v = Math.abs(a[i]); if (v > m) m = v; } return m; };
  // -> an AudioBuffer (o.parts: also { shot, mech } as Float32Arrays, for the checks)
  function suppressBuffer(buf, def, mechBuf, o) {
    const S = C().suppressed, sr = buf.sampleRate, all = buf.getChannelData(0);
    const mech = mechBuf ? mechBuf.getChannelData(0) : null;
    // (only as long as the shot is heard -- its tail is gone by S.length -- or
    // its action goes on: a fifth of the work of the whole buffer)
    let mEnd = 0;
    if (mech) for (let i = mech.length - 1; i > 0; i--) if (Math.abs(mech[i]) > 3e-4) { mEnd = i; break; }
    const n = Math.min(all.length, Math.max(Math.floor(sr * S.length), mEnd + Math.floor(sr * 0.02)));
    const src = all.subarray(0, n), p0 = peakOf(all) || 1, pk = p0 * db(S.crackDb);
    // the crack in its band (`order` stages each side, 12 dB an octave each)
    let y = src;
    for (let i = 0; i < (S.order || 2); i++) y = biquad(y, sr, "hp", S.band[0], 0.707);
    for (let i = 0; i < (S.order || 2); i++) y = biquad(y, sr, "lp", S.band[1], 0.707);
    const shot = new Float32Array(n);
    const t0 = Math.floor(sr * S.tail[0]), te = sr * S.tail[1];
    for (let i = 0; i < n; i++) shot[i] = y[i] * (i < t0 ? 1 : Math.pow(10, (S.tailDb / 20) * ((i - t0) / (te - t0))));
    // the body: a short sine falling 200 -> 120 Hz, as loud as `gain` of the crack
    const scale = pk / (peakOf(shot) || 1);
    for (let i = 0; i < n; i++) shot[i] *= scale;
    const crack = o && o.parts ? shot.slice() : null;              // (the checks measure the crack alone too)
    const B = S.body, bodyN = Math.min(n, Math.floor(sr * B.dur * 1.6));
    let ph = 0;
    for (let i = 0; i < bodyN; i++) {
      const t = i / sr, f = B.f0 + (B.f1 - B.f0) * Math.min(1, t / B.dur);
      ph += 2 * Math.PI * f / sr;
      shot[i] += Math.sin(ph) * pk * B.gain * Math.min(1, t / 0.003) * Math.exp(-t / (B.dur * 0.35));
    }
    // a sniper's supersonic crack, faint and high
    if (S.crack && familyOf(def) === "sniper_bolt") {
      let prev = 0;
      for (let i = 0; i < Math.floor(sr * 0.004) && i < n; i++) { const w = Math.random() * 2 - 1, hp = w - prev; prev = w; shot[i] += hp * p0 * db(S.crackDbSniper) * (1 - i / (sr * 0.004)); }
    }
    // the head held to its level (crack and body together)
    const k2 = pk / (peakOf(shot, 0, Math.min(n, Math.floor(sr * 0.05))) || 1);
    for (let i = 0; i < n; i++) shot[i] *= k2;
    // the action's own sound on top, down only mechDb + crackDb (-6 dB)
    const out = new Float32Array(n), mk = db(S.mechDb + S.crackDb);
    for (let i = 0; i < n; i++) out[i] = shot[i] + (mech && i < mech.length ? mech[i] * mk : 0);
    // (trimmed after the last sound worth hearing, as the plain ones are)
    let end = n - 1;
    while (end > 0 && Math.abs(out[end]) < 3e-4) end--;
    const len = Math.max(1, Math.min(n, end + Math.floor(sr * 0.02)));
    const b = (o && o.ctx ? o.ctx : G.Audio.ctx).createBuffer(1, len, sr);
    b.getChannelData(0).set(out.subarray(0, len));
    if (o && o.parts) b.parts = { shot, crack, mech, p0, pk };
    return b;
  }

  // ---------------- what learning unlocks ----------------
  // Read only: the memory boxes, the Daily Review's best run, the forms of a
  // word answered right, the run of spellings, the notes kept, the bosses of
  // a run -- nothing here writes the learning record.
  const low = (s) => String(s == null ? "" : s).trim().toLowerCase();
  const entryKey = (k) => String(k).split("@")[0];
  // the forms of a word the game asks about: its headword, and the form each
  // of its example sentences uses (a Cloze question's answer)
  const askCache = {};
  function askable(e) {
    if (askCache[e.id]) return askCache[e.id];
    const out = [low(e.headword || e.id)];
    if (G.Clues && G.WordBank) {
      const p = G.WordBank.pairOf(e, "en", "th");
      const list = e.examples || (e.example ? [e.example] : []);
      list.forEach((_, i) => { const c = G.Clues.cloze(p, i); if (c && c.answer && !out.includes(low(c.answer))) out.push(low(c.answer)); });
    }
    return (askCache[e.id] = out);
  }
  function progress() {
    const Lr = G.save && G.save.learn, S = (Lr && Lr.srs) || {}, D = data(), box = C().rememberBox;
    // remembered: every word in box 4 or up, in any language it is learnt in
    const keys = Object.keys(S).filter((k) => S[k] && S[k].b >= box);
    const known = new Set(keys.map(entryKey));
    const mastered = new Set(Object.keys(S).filter((k) => S[k] && S[k].b >= G.Learning.MASTERED && k.indexOf("@") > 0).map(entryKey));
    const topics = {};
    const entries = G.WordBank ? G.WordBank.entries() : [];
    entries.forEach((e) => { if (!e.topic) return; const t = topics[e.topic] || (topics[e.topic] = { n: 0, k: 0 }); t.n++; if (known.has(e.id)) t.k++; });
    // a word family complete: its word remembered and every form of it the
    // game asks answered right at least once (learnt in another language than
    // English, where the forms are not asked: the word Mastered)
    let families = 0;
    entries.forEach((e) => {
      if (!known.has(e.id) || !(e.family && e.family.length)) return;
      const got = D.forms[e.id];
      if (got) { const ask = askable(e); if (ask.length >= 2 && ask.every((f) => got.includes(f))) { families++; return; } }
      if (mastered.has(e.id)) families++;
    });
    const ach = (G.save && G.save.achievements) || {};
    return {
      remembered: keys.length,
      streak: (Lr && Lr.daily && Math.max(Lr.daily.best || 0, Lr.daily.streak || 0)) || 0,
      families,
      topics: Object.keys(topics).reduce((o, t) => { o[t] = topics[t].n ? topics[t].k / topics[t].n : 0; return o; }, {}),
      spellRun: Math.max(D.spellBest || 0, (Lr && Lr.spellRun) || 0),
      notes: { level1: !!ach.notes_level1, level2: !!ach.notes_level2, level3: !!ach.notes_level3 },
      bosses: D.bossesBest || 0,
    };
  }
  function met(u, P) {
    switch (u.kind) {
      case "remembered": return P.remembered >= u.n;
      case "streak": return P.streak >= u.n;
      case "families": return P.families >= u.n;
      case "topic": return (P.topics[u.topic] || 0) >= u.share;
      case "spellRun": return P.spellRun >= u.n;
      case "notes": return !!P.notes[u.level];
      case "bosses": return P.bosses >= u.n;
      default: return false;
    }
  }
  // how far along: [now, wanted]
  function along(u, P) {
    switch (u.kind) {
      case "remembered": return [P.remembered, u.n];
      case "streak": return [P.streak, u.n];
      case "families": return [P.families, u.n];
      case "topic": return [Math.floor((P.topics[u.topic] || 0) * 100), Math.round(u.share * 100)];
      case "spellRun": return [P.spellRun, u.n];
      case "bosses": return [P.bosses, u.n];
      default: return [P.notes[u.level] ? 1 : 0, 1];
    }
  }
  // -> the ids unlocked just now (a toast for them, unless quiet)
  function check(opts) {
    opts = opts || {};
    if (!on() || !G.save || !G.save.learn) return [];
    const D = data(), P = progress(), fresh = [];
    G.ATTACH_UNLOCKS.forEach((u) => { if (!D.unlocked[u.id] && met(u, P)) { D.unlocked[u.id] = G.Clock ? G.Clock.today() : 1; fresh.push(u.id); } });
    if (!fresh.length) return fresh;
    apply();
    if (G.persist) G.persist();
    if (!opts.quiet) toast(fresh);
    if (G.Bus) G.Bus.emit("attach:unlock", { ids: fresh.slice() });
    return fresh;
  }
  let checkT = null;
  function soon() { if (checkT || !on()) return; checkT = setTimeout(() => { checkT = null; check(); }, 400); }
  function skinName(k) {
    const s = G.GUN_SKINS[k];
    if (s && s.topic) return T("skin.camo", { topic: G.topicLabel(s.topic) });
    return T("skin." + k);
  }
  function nameOf(id) { return String(id).indexOf("skin:") === 0 ? skinName(id.slice(5)) : T("att." + id + ".name"); }
  // the toast of G.UI.showAchievementToast, after one already up has gone
  function toast(ids) {
    const UI = G.UI, el = UI && UI.el && UI.el("hud-achievement-toast");
    if (!el) return;
    if (!el.classList.contains("hidden") && el.style.opacity !== "0") { setTimeout(() => toast(ids), 3600); return; }
    const hud = UI.el("hud"), menu = !hud || hud.classList.contains("hidden");
    const host = menu ? document.body : hud;
    if (el.parentNode !== host) host.appendChild(el);
    el.classList.toggle("toast-menu", menu);
    const list = ids.slice(0, 3).map((i) => "🔓 " + esc(nameOf(i))).join("<br>") + (ids.length > 3 ? "<br>" + esc(T("unlock.more", { n: ids.length - 3 })) : "");
    el.innerHTML = `<b>${esc(T("unlock.title"))}</b><br>${list}`;
    el.classList.remove("hidden");
    el.style.opacity = "1"; el.style.transform = "translateX(0)";
    clearTimeout(UI._toastTimer);
    UI._toastTimer = setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(20px)"; setTimeout(() => el.classList.add("hidden"), 300); }, 3600);
  }
  // what the learning hooks tell (js/srs.js, js/bosses.js): a form of a word
  // answered right, the run of spellings, the bosses of this run
  function noteForm(pair, form) {
    if (!on() || !pair || !form || !G.WordBank) return;
    const id = G.wordKey(pair);
    if (String(id).indexOf("@") >= 0) return;          // (the forms are English)
    const e = G.WordBank.byId(id);
    if (!e || !(e.family && e.family.length)) return;
    const f = low(form);
    if (!askable(e).includes(f)) return;
    const D = data(), got = D.forms[e.id] || (D.forms[e.id] = []);
    if (!got.includes(f)) { got.push(f); soon(); }
  }
  function onSpellRun(n) { const D = data(); if (on() && n > (D.spellBest || 0)) { D.spellBest = n; if (n >= Math.min(...G.ATTACH_UNLOCKS.filter((u) => u.kind === "spellRun").map((u) => u.n))) soon(); } }
  function onBoss(n) { const D = data(); if (on() && n > (D.bossesBest || 0)) { D.bossesBest = n; soon(); } }

  // ---------------- the Armory's window for one gun ----------------
  const chips = (def) => SLOTS().map((s) => loadoutOf(def)[s]).filter(Boolean);
  // what is fitted does, in words ("Aim time +4%", "Magazine +50%"): the Stat Card
  function effects(def) {
    const M = mods(def), out = [], pct = (v) => (v > 1 ? "+" : "-") + Math.round(Math.abs(v - 1) * 100) + "%";
    if (M.optic) out.push(T("atteff.zoom", { v: +G.ATTACHMENTS[M.optic].zoom.toFixed(2) }));
    ["ads", "sway", "range", "recoilV", "recoilH", "mag", "reload", "hip"].forEach((k) => { if (Math.abs(M[k] - 1) > 0.001) out.push(T("atteff." + k, { v: pct(M[k]) })); });
    if (M.loud) out.push(T("atteff.loud", { v: M.loud }));
    if (M.sound === "suppressed") out.push(T("atteff.quiet"));
    if (M.flash === 0) out.push(T("atteff.noFlash")); else if (Math.abs(M.flash - 1) > 0.001) out.push(T("atteff.flash", { v: pct(M.flash) }));
    if (M.laser) out.push(T("atteff.laser"));
    return out;
  }
  // (won: the condition alone -- it stays unlocked though words drop back a
  // box; P: progress() worked out once for a whole list)
  function conditionOf(id, won, P) {
    const u = G.ATTACH_UNLOCKS.find((x) => x.id === id);
    if (!u) return "";
    if (u.kind === "notes") { const lv = G.getLevel(+u.level.slice(5)); return T("unlock.notes", { level: lv ? lv.name : u.level }); }
    const [a, b] = along(u, P || progress());
    const what = u.kind === "topic" ? T("unlock.topic", { topic: G.topicLabel(u.topic), n: b }) : T("unlock." + u.kind, { n: u.n });
    return won ? what : what + " (" + Math.min(a, b) + "/" + b + ")";
  }
  function editorHtml(def) {
    const L = loadoutOf(def), D0 = data(), own = !!D0.loadout[def.id], shared = !own && Object.keys(D0.family[familyOf(def)] || {}).length > 0;
    let P = null;
    const cond = (id) => conditionOf(id, false, P || (P = progress()));
    const rows = SLOTS().map((s) => {
      const list = allowed(def, s);
      if (!list.length) return "";
      const open = list.filter(unlocked), shut = list.filter((id) => !unlocked(id));
      const opts = [`<option value="">${esc(T("att.none"))}</option>`].concat(open.map((id) => `<option value="${id}"${L[s] === id ? " selected" : ""}>${esc(T("att." + id + ".name"))}</option>`)).join("");
      const cur = L[s] ? `<div class="att-desc">${esc(T("att." + L[s] + ".desc"))}</div>` : "";
      const locked = shut.map((id) => `<div class="att-lock">🔒 ${esc(T("att." + id + ".name"))}: ${esc(cond(id))}</div>`).join("");
      return `<div class="att-row"><label for="att-${s}">${esc(T("att.slot." + s))}</label><select id="att-${s}" data-slot="${s}">${opts}</select>${cur}${locked}</div>`;
    }).join("");
    const skins = Object.keys(G.GUN_SKINS).filter((k) => unlocked("skin:" + k));
    const skinRow = `<div class="att-row"><label for="att-skin">${esc(T("att.slot.skin"))}</label><select id="att-skin">${skins.map((k) => `<option value="${k}"${(L.skin || "factory") === k ? " selected" : ""}>${esc(skinName(k))}</option>`).join("")}</select><div class="att-desc">${esc(T("att.skinNote"))}</div></div>`;
    const fam = `<label class="att-fam"><input type="checkbox" id="att-family"${shared ? " checked" : ""}> ${esc(T("att.forFamily", { family: T("family." + familyOf(def)) }))}</label>`;
    const note = editable() ? "" : `<div class="att-lock">${esc(T("att.onlyShop"))}</div>`;
    return `<div class="att-editor">${rows || `<div class="att-desc">${esc(T("att.noneFit"))}</div>`}${skinRow}${fam}${note}</div>`;
  }
  function openEditor(def, onDone) {
    if (!G.Dialog || !def) return;
    const can = editable();
    G.Dialog.open({
      title: T("att.title", { name: def.name }), body: editorHtml(def), focus: allowed(def, "optic").length ? "att-optic" : "att-skin",
      buttons: [
        { label: T("att.save"), primary: true, disabled: !can, action: () => {
          const box = document.getElementById("dialog-body"), L = {};
          box.querySelectorAll("select[data-slot]").forEach((s) => { if (s.value) L[s.dataset.slot] = s.value; });
          const sk = document.getElementById("att-skin");
          if (sk && sk.value && sk.value !== "factory") L.skin = sk.value;
          const fam = document.getElementById("att-family");
          setAll(def.id, L, !!(fam && fam.checked));
          if (onDone) onDone();
        } },
        { label: T("dialog.cancel"), cancel: true },
      ],
    });
  }
  // the AWARDS page: every unlock, won or how far along
  function awardsHtml() {
    const D = data(), P = progress();
    return `<div class="achievement-group-title">${esc(T("unlock.awards"))}</div>` + G.ATTACH_UNLOCKS.map((u) => {
      const got = !!D.unlocked[u.id];
      return `<div class="achievement-item ${got ? "" : "locked"}" data-unlock="${esc(u.id)}"><div class="achievement-icon">${got ? "🔓" : "🔒"}</div>`
        + `<div><div class="achievement-name">${esc(nameOf(u.id))}</div><div class="achievement-desc">${esc(conditionOf(u.id, got, P))}</div></div></div>`;
    }).join("");
  }

  return { on, normalize, data, familyOf, ownScope, allowed, unlocked, loadoutOf, combine, mods, apply, editable, set, setSkin, setAll, setFamily,
    rail, adsFor, decorate, aimFov, magnified, sway, laser, suppressed, flash, loud, suppressBuffer,
    askable, progress, along, check, soon, noteForm, onSpellRun, onBoss, nameOf, skinName, chips, effects, conditionOf, editorHtml, openEditor, awardsHtml,
    get dot() { return dot; }, get preview() { return preview; }, set preview(v) { preview = v || null; modCache = {}; } };
})();

// (a wave over, a run over: anything learnt in it that unlocks something)
if (G.Bus) ["game:shop", "game:over", "game:victory"].forEach((t) => G.Bus.on(t, () => G.Attach.soon(), "attach"));
