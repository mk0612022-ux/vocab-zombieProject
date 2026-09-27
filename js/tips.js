// ===================================================================
// Icon labels and tooltips (B)
// -------------------------------------------------------------------
// Every button that is only an icon carries a short name under it, and its
// full name as a tooltip:
//   data-label="Vocab"          the short name, drawn under the icon (CSS)
//   data-tip="Vocabulary Log"   the full name, shown
//     - after resting the mouse on it,
//     - on a long press on a touch screen (and then the press does NOT
//       also count as a tap, so it never opens what it only named),
//     - while a controller or the keyboard has it selected.
// data-label-key / data-tip-key take a key of js/strings.js instead, filled
// in by G.Tips.applyKeys (the page's static buttons).
// One tooltip element for the whole page; nothing here runs per frame.
// ===================================================================
G.Tips = {
  HOVER_MS: 350,
  PRESS_MS: 450,

  init() {
    const tip = document.createElement("div");
    tip.id = "tip"; tip.className = "tip hidden"; tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
    this.el = tip;
    this.applyKeys(document);
    const target = (e) => (e.target && e.target.closest ? e.target.closest("[data-tip]") : null);
    // mouse: rest on it
    document.addEventListener("pointerover", (e) => {
      if (e.pointerType !== "mouse") return;
      const t = target(e);
      if (!t || t === this._hoverEl) return;
      this._hoverEl = t;
      clearTimeout(this._hoverT);
      this._hoverT = setTimeout(() => { if (this._hoverEl === t && t.isConnected) this.show(t); }, this.HOVER_MS);
    });
    document.addEventListener("pointerout", (e) => {
      if (e.pointerType !== "mouse") return;
      const t = target(e);
      if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
      this._hoverEl = null; clearTimeout(this._hoverT); this.hide(t);
    });
    // touch: a long press shows it; the tap that ends the press is swallowed
    document.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") { clearTimeout(this._hoverT); this.hide(); return; }
      const t = target(e);
      if (!t) return;
      const x0 = e.clientX, y0 = e.clientY;
      clearTimeout(this._pressT);
      this._press = { el: t, x0, y0, long: false, t0: performance.now() };
      this._pressT = setTimeout(() => {
        if (!this._press || this._press.el !== t) return;
        this._press.long = true;
        this.show(t);
        if (navigator.vibrate) try { navigator.vibrate(8); } catch (err) { /* not allowed */ }
      }, this.PRESS_MS);
    }, { passive: true });
    document.addEventListener("pointermove", (e) => {
      const p = this._press;
      if (p && !p.long && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 12) { clearTimeout(this._pressT); this._press = null; }
    }, { passive: true });
    const end = () => {
      clearTimeout(this._pressT);
      const p = this._press;
      // (held long enough even if the timer was late -- a busy page)
      if (p && !p.long && performance.now() - p.t0 >= this.PRESS_MS) { p.long = true; this.show(p.el); }
      if (p && p.long) {
        this._swallowUntil = performance.now() + 700;
        this._swallowEl = p.el;
        clearTimeout(this._hideT);
        this._hideT = setTimeout(() => this.hide(p.el), 1400);
      }
      this._press = null;
    };
    document.addEventListener("pointerup", end, { passive: true });
    document.addEventListener("pointercancel", end, { passive: true });
    document.addEventListener("click", (e) => {
      if (performance.now() < (this._swallowUntil || 0) && this._swallowEl && this._swallowEl.contains(e.target)) {
        e.preventDefault(); e.stopPropagation(); this._swallowUntil = 0;
      }
    }, true);
    // a long press would otherwise also open the browser's own menu
    document.addEventListener("contextmenu", (e) => { if (target(e)) e.preventDefault(); });
    // the keyboard or a controller moving onto it
    document.addEventListener("focusin", (e) => {
      const t = target(e);
      if (t && document.body.dataset.input !== "touch" && (t.matches(":focus-visible") || t.classList.contains("pad-focus"))) this.show(t);
    });
    document.addEventListener("focusout", (e) => { const t = target(e); if (t) this.hide(t); });
    window.addEventListener("resize", () => this.hide());
  },

  // fill data-label / data-tip from their string keys
  applyKeys(root) {
    (root || document).querySelectorAll("[data-label-key]").forEach((el) => { el.dataset.label = G.T(el.dataset.labelKey); });
    (root || document).querySelectorAll("[data-tip-key]").forEach((el) => { el.dataset.tip = G.T(el.dataset.tipKey); });
  },

  show(el) {
    if (!this.el || !el || !el.dataset.tip) return;
    const tip = this.el;
    tip.textContent = el.dataset.tip;
    tip.classList.remove("hidden");
    this._for = el;
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    const W = window.innerWidth, H = window.innerHeight, gap = 8;
    // below when there is room (the icon rows sit at the top of the screen),
    // otherwise above; always inside the screen
    let top = r.bottom + gap;
    if (top + th > H - 4) top = r.top - th - gap;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(6, Math.min(W - tw - 6, left));
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(4, top))}px)`;
  },
  hide(el) {
    if (!this.el || (el && this._for && el !== this._for)) return;
    this.el.classList.add("hidden");
    this._for = null;
  },
};
