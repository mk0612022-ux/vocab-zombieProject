// ===================================================================
// The Stat Card (expansion, round 3)
// -------------------------------------------------------------------
// One card for a gun wherever its numbers are shown: the Armory, a wall gun
// about to be bought, the mystery box, a crate, the shop. Six bars -- how the
// gun ranks among all of them, 0-100 -- and the real numbers, read from the
// one sheet (G.GunStats), which the HUD's label reads too.
// (round 4) A melee weapon has a card of its own: six bars of its own, ranked
// among the melee weapons, compared with the one in the melee slot.
//
//   G.StatCard.html(def, { compare, lvl })   compare: the gun in hand (a melee
//                                            weapon: the one in the slot), its
//                                            bars then show the difference
//   G.StatCard.held()                        the gun in hand, in a run
//   G.StatCard.heldMelee()                   the melee slot's weapon, in a run
//   G.StatCard.status(def)                   the HUD's label: rarity · weight
//   G.StatCard.showHud(def) / hideHud()      beside a wall gun
// ===================================================================
window.G = window.G || {};

G.StatCard = (function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const hex = (c) => "#" + c.toString(16).padStart(6, "0");
  const MELEE_COLOR = "#d9a441";
  let hudFor = null;

  function inRun() {
    const g = G.Game;
    return g && g.player && (g.state === "GAMEPLAY" || g.state === "PAUSE" || g.state === "SHOP") ? g : null;
  }
  function held() {
    const g = inRun();
    if (!g) return null;
    const def = g.currentWeaponDef();
    return def && def.id !== "melee" ? def : null;
  }
  function heldMelee() { const g = inRun(); return g ? G.meleeDef(g) : null; }
  function delta(a, b) {
    const d = a - b;
    if (!d) return '<span class="statc-delta same" aria-hidden="true">=</span>';
    const up = d > 0;
    return `<span class="statc-delta ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(d)}</span>`;
  }
  const bar = (k, pct, color, other) => `<div class="statc-bar"><span class="statc-label">${esc(T("stat." + k))}</span>`
    + `<span class="statc-track" role="img" aria-label="${esc(T("stat." + k))} ${pct}"><i style="width:${pct}%;background:${color}"></i></span>`
    + `<b class="statc-pct">${pct}</b>${other ? delta(pct, other[k].pct) : ""}</div>`;
  const numbers = (list) => list.map(([k, v]) => `<span><i>${esc(T(k))}</i> <b>${esc(v)}</b></span>`).join("");
  const tagsOf = (list) => list.filter(Boolean).map((x) => `<span class="statc-tag">${esc(x)}</span>`).join("");

  function meleeHtml(def, opts) {
    const s = G.GunStats.melee(def), st = G.GunStats.meleeStats(def);
    const cmp = opts.compare && opts.compare.key !== def.key ? opts.compare : null, other = cmp ? G.GunStats.meleeStats(cmp) : null;
    return `<div class="stat-card melee${cmp ? " compare" : ""}">`
      + (opts.name === false ? "" : `<div class="statc-head"><span class="statc-name" style="color:${MELEE_COLOR}">${esc(def.name)}</span><span class="statc-rarity">${esc(T("hud.melee"))}</span></div>`)
      + `<div class="statc-tags">${tagsOf([T("melee.niche." + def.key), T("melee.stagger." + s.stagger), s.powerTime ? T("melee.tag.power") : "", s.combo ? T("melee.tag.combo") : ""])}</div>`
      + `<div class="statc-bars">${G.GunStats.M_KEYS.map((k) => bar(k, st[k].pct, MELEE_COLOR, other)).join("")}</div>`
      + `<div class="statc-nums">${numbers([["stat.swing", T("stat.ms", { n: s.swing })], ["stat.reach", T("stat.metres", { n: s.range })], ["stat.targets", s.targets], ["stat.stamina", s.stamina]])}</div>`
      + (cmp ? `<div class="statc-vs">${esc(T("stat.vs", { name: cmp.name }))}</div>` : "")
      + `</div>`;
  }
  function html(def, opts) {
    opts = opts || {};
    if (def.id === "melee") return meleeHtml(def, opts);
    const s = G.GunStats.of(def), st = G.GunStats.stats(def), lvl = opts.lvl;
    const rc = hex(G.RARITY[def.rarity].color);
    const cmp = opts.compare && opts.compare.id !== def.id ? opts.compare : null;
    const other = cmp ? G.GunStats.stats(cmp) : null;
    const wc = G.weightClass(def);
    const bars = G.GunStats.KEYS.map((k) => bar(k, st[k].pct, rc, other)).join("");
    const mag = lvl ? Math.round(s.mag * (lvl.mag || 1)) : s.mag;
    const nums = numbers([["stat.mag", mag], ["stat.reserve", G.GunStats.reserve(def, mag)], ["stat.reload", T("stat.seconds", { s: s.reloadEmpty.toFixed(1) })], ["stat.rpm", s.rpm]]);
    const tags = tagsOf([s.niche ? T("niche." + s.niche) : "", G.fireModeLabel(def)]);
    return `<div class="stat-card${cmp ? " compare" : ""}">`
      + (opts.name === false ? "" : `<div class="statc-head"><span class="statc-name" style="color:${rc}">${esc(def.name)}</span><span class="statc-rarity">${esc(G.RARITY[def.rarity].label)}</span></div>`)
      + `<div class="statc-tags">${tags}<span class="statc-tag" style="color:${wc.color}">${esc(wc.label)}</span></div>`
      + `<div class="statc-bars">${bars}</div>`
      + `<div class="statc-nums">${nums}</div>`
      + (cmp ? `<div class="statc-vs">${esc(T("stat.vs", { name: cmp.name }))}</div>` : "")
      + `</div>`;
  }
  // (Word Forge's tier joins it in round 6)
  function status(def) {
    return [G.RARITY[def.rarity].label, G.weightClass(def).label].join(" · ");
  }
  // beside a wall gun: it needs no button, so every kind of control has it
  function showHud(def) {
    const el = document.getElementById("hud-statcard");
    if (!el) return;
    const blade = def.id === "melee", against = blade ? heldMelee() : held();
    const key = [def.key || def.id, (against || {}).key || (against || {}).id, G.lang].join("|");
    if (hudFor !== key) { el.innerHTML = html(def, { compare: against }); hudFor = key; }
    el.classList.remove("hidden");
  }
  function hideHud() {
    if (hudFor === null) return;
    hudFor = null;
    const el = document.getElementById("hud-statcard");
    if (el) { el.classList.add("hidden"); el.innerHTML = ""; }
  }
  return { html, held, heldMelee, status, showHud, hideHud };
})();
