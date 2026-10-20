// ===================================================================
// The event bus (overhaul, round 1)
// -------------------------------------------------------------------
// One place where a system says "this happened" and the others that care
// hear it -- the weapon state machine (js/weaponsm.js) tells the gun's
// animation, its sounds and the HUD this way, instead of calling each one.
// Synchronous: every listener runs at once, in the same frame, so a sound or
// an effect lands on the frame of what caused it.
//
//   G.Bus.on(type, fn, owner)   listen; returns a token
//   G.Bus.off(tokenOrOwner)     stop one listener, or every one an owner added
//   G.Bus.emit(type, payload)   tell them (payload is handed over as it is)
//   G.Bus.recent                the last ten events (the debug overlay)
//
// docs/overhaul/architecture.md lists who sends and who hears what.
// ===================================================================
window.G = window.G || {};

G.Bus = {
  _ls: {},          // type -> [{ fn, owner, token }]
  _token: 0,
  recent: [],

  on(type, fn, owner) {
    const t = ++this._token;
    (this._ls[type] || (this._ls[type] = [])).push({ fn, owner: owner || null, token: t });
    return t;
  },
  off(key) {
    Object.keys(this._ls).forEach((type) => {
      this._ls[type] = this._ls[type].filter((l) => l.token !== key && (key == null || l.owner !== key));
    });
  },
  emit(type, payload) {
    this.recent.push({ type, p: payload });
    if (this.recent.length > 10) this.recent.shift();
    const ls = this._ls[type];
    if (!ls || !ls.length) return;
    // (a copy: a listener may take itself off while it runs)
    const list = ls.slice();
    for (let i = 0; i < list.length; i++) {
      try { list[i].fn(payload, type); } catch (err) { if (window.console) console.error("[G.Bus] " + type, err); }
    }
  },
};
