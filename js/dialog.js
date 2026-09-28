// ===================================================================
// A small question window (round 3, J3): "Continue from Wave 11, or a new
// run?", "This will delete your checkpoint -- start again?"
// -------------------------------------------------------------------
// One title, one line of text, two or three buttons. A G.Modal window, so
// the mouse is freed and nothing behind it takes a key; it pauses a run if
// one is being played. Mouse, touch, keys (Enter the main button, Escape
// the cancel one, 1-3 any of them) and a controller (D-pad, A, B cancels).
//
//   G.Dialog.open({ title, text, buttons: [{ label, primary, danger, cancel, action }] })
//   G.Dialog.confirm({ title, text, yes, no, danger }, onYes)
// ===================================================================
G.Dialog = {
  _o: null,
  el(id) { return document.getElementById(id); },
  isOpen() { return !!this._o; },

  open(o) {
    if (this._o) this.close();
    this._o = o;
    const esc = G.escapeHtml, box = this.el("dialog-box");
    box.classList.toggle("danger", !!o.danger);
    this.el("dialog-icon").textContent = o.icon || "";
    this.el("dialog-icon").classList.toggle("hidden", !o.icon);
    this.el("dialog-title").textContent = o.title || "";
    this.el("dialog-text").textContent = o.text || "";
    const btns = this.el("dialog-btns");
    btns.innerHTML = o.buttons.map((b, i) => `<button class="btn${b.primary ? " btn-primary" : ""}${b.danger ? " btn-danger" : ""}" data-i="${i}"${b.cancel ? " data-pad-back" : ""}>${esc(b.label)}<span class="kbd-only dlg-key"> (${b.cancel ? "Esc" : b.primary ? "Enter" : i + 1})</span></button>`).join("");
    btns.querySelectorAll("button").forEach((b) => { b.onclick = () => this.choose(parseInt(b.dataset.i, 10)); });
    this.el("dialog").classList.remove("hidden");
    const g = G.Game;
    G.Modal.open("dialog", { pause: !!(g && g.state === "GAMEPLAY"), keys: (e) => {
      const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (e.code === "Escape" || e.code === "Backspace") { const c = o.buttons.findIndex((b) => b.cancel); if (c >= 0) this.choose(c); return true; }
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        const f = document.activeElement && document.activeElement.closest && document.activeElement.closest("#dialog-btns button");
        this.choose(f ? parseInt(f.dataset.i, 10) : Math.max(0, o.buttons.findIndex((b) => b.primary)));
        return true;
      }
      if (n && +n[1] <= o.buttons.length) { this.choose(+n[1] - 1); return true; }
      if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Tab") { this.moveFocus(e.code === "ArrowLeft" ? -1 : 1); if (e.preventDefault) e.preventDefault(); return true; }
      return true;
    } });
    if (G.Input.mode !== "touch") setTimeout(() => {
      if (this._o !== o) return;
      const p = btns.querySelector(".btn-primary") || btns.querySelector("button");
      if (p) p.focus({ preventScroll: true });
    }, 0);
  },
  moveFocus(d) {
    const list = Array.from(this.el("dialog-btns").querySelectorAll("button"));
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    list[(i + d + list.length) % list.length].focus({ preventScroll: true });
  },
  choose(i) {
    const o = this._o;
    if (!o) return;
    const b = o.buttons[i];
    this.close();
    if (b && b.action) b.action();
  },
  close() {
    if (!this._o) return;
    this._o = null;
    this.el("dialog").classList.add("hidden");
    G.Modal.close("dialog");
  },
  // Yes / No
  confirm(o, onYes) {
    this.open({
      title: o.title, text: o.text, icon: o.icon, danger: o.danger,
      buttons: [
        { label: o.yes || G.T("dialog.yes"), primary: !o.danger, danger: !!o.danger, action: onYes },
        { label: o.no || G.T("dialog.cancel"), cancel: true, primary: !!o.danger },
      ],
    });
  },
};
