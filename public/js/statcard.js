// ===================================================================
// The Stat Card (expansion, round 3)
// -------------------------------------------------------------------
// One card for a gun wherever its numbers are shown: the Armory, a wall gun
// about to be bought, the mystery box, a crate, the shop. Six bars -- how the
// gun ranks among all of them, 0-100 -- and the real numbers, read from the
// one sheet (G.GunStats), which the HUD's label reads too.
//
//   G.StatCard.html(def, { compare, lvl })   compare: the gun in hand, its
//                                            bars then show the difference
//   G.StatCard.held()                        the gun in hand, in a run
//   G.StatCard.status(def)                   the HUD's label: rarity · weight
//   G.StatCard.showHud(def) / hideHud()      beside a wall gun
// ===================================================================
window.G = window.G || {};

G.StatCard = (function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const hex = (c) => "#" + c.toString(16).padStart(6, "0");
  let hudFor = null;

  function held() {
    const g = G.Game;
    if (!g || !g.player || (g.state !== "GAMEPLAY" && g.state !== "PAUSE" && g.state !== "SHOP")) return null;
    const def = g.currentWeaponDef();
    return def && def.id !== "melee" ? def : null;
  }
  function delta(a, b) {
    const d = a - b;
    if (!d) return '<span class="statc-delta same" aria-hidden="true">=</span>';
    const up = d > 0;
    return `<span class="statc-delta ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(d)}</span>`;
  }
  function html(def, opts) {
    opts = opts || {};
    const s = G.GunStats.of(def), st = G.GunStats.stats(def), lvl = opts.lvl;
    const rc = hex(G.RARITY[def.rarity].color);
    const cmp = opts.compare && opts.compare.id !== def.id ? opts.compare : null;
    const other = cmp ? G.GunStats.stats(cmp) : null;
    const wc = G.weightClass(def);
    const bars = G.GunStats.KEYS.map((k) => {
      const pct = st[k].pct;
      return `<div class="statc-bar"><span class="statc-label">${esc(T("stat." + k))}</span>`
        + `<span class="statc-track" role="img" aria-label="${esc(T("stat." + k))} ${pct}"><i style="width:${pct}%;background:${rc}"></i></span>`
        + `<b class="statc-pct">${pct}</b>${other ? delta(pct, other[k].pct) : ""}</div>`;
    }).join("");
    const mag = lvl ? Math.round(s.mag * (lvl.mag || 1)) : s.mag;
    const nums = [["stat.mag", mag], ["stat.reserve", G.GunStats.reserve(def, mag)], ["stat.reload", T("stat.seconds", { s: s.reloadEmpty.toFixed(1) })], ["stat.rpm", s.rpm]]
      .map(([k, v]) => `<span><i>${esc(T(k))}</i> <b>${esc(v)}</b></span>`).join("");
    const tags = [s.niche ? T("niche." + s.niche) : "", G.fireModeLabel(def)].filter(Boolean).map((x) => `<span class="statc-tag">${esc(x)}</span>`).join("");
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
    const key = [def.id, (held() || {}).id, G.lang].join("|");
    if (hudFor !== key) { el.innerHTML = html(def, { compare: held() }); hudFor = key; }
    el.classList.remove("hidden");
  }
  function hideHud() {
    if (hudFor === null) return;
    hudFor = null;
    const el = document.getElementById("hud-statcard");
    if (el) { el.classList.add("hidden"); el.innerHTML = ""; }
  }
  return { html, held, status, showHud, hideHud };
})();
