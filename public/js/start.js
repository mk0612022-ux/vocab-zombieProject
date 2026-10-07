// ===================================================================
// The Start screen (new series, round 2, E)
// -------------------------------------------------------------------
// Between the Loading screen and the lobby, once each time the game opens:
// the horde (public/assets/boot/start-horde.webp) on a dark green that
// fades to black, motes of light drifting up, "Tap To Lobby" glowing, and
// under it who is playing -- "Guest" and Sign In until there are accounts
// (round 4, G.Account) -- and the version in the corner.
//
// Anywhere on it, any key, or A on a controller: the lobby. That press is
// also what lets a phone or tablet play sound (iOS starts audio only inside
// a touch or a key), so the lobby's music starts with it. Sign In (its own
// button: Tab or the D-pad to it, then Enter or A) does not count as the press.
// A G.Modal window ("start"): the lobby's own keys wait until it has gone.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const $ = (id) => document.getElementById(id);

  G.Start = {
    shown: false,

    build() {
      if (this._built) return;
      this._built = true;
      const el = $("start-screen");
      // the motes: a few dozen, each its own place, speed and drift
      const motes = $("start-motes");
      let html = "";
      for (let i = 0; i < 28; i++) {
        const left = (Math.random() * 100).toFixed(1), top = (40 + Math.random() * 62).toFixed(1);
        const dur = (10 + Math.random() * 12).toFixed(1), delay = (-Math.random() * 20).toFixed(1);
        const dx = Math.round(-40 + Math.random() * 80), size = (1.5 + Math.random() * 2.5).toFixed(1);
        html += `<i style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;--dx:${dx}px"></i>`;
      }
      motes.innerHTML = html;
      // anywhere but Sign In
      el.addEventListener("click", (e) => { if (!e.target.closest("#btn-start-signin")) this.enter(); });
      $("btn-start-signin").onclick = (e) => { e.stopPropagation(); this.signIn(); };
    },

    // from js/updater.js, once Loading is done (or the player chose to play
    // an old version)
    show() {
      if (this.shown) return;
      this.build();
      this.shown = true;
      this.refresh();
      const el = $("start-screen");
      el.classList.remove("hidden", "leaving");
      G.Modal.open("start", { keys: (e) => this.key(e) });
      setTimeout(() => { if (G.Input.mode !== "touch" && this.shown) $("start-tap").focus({ preventScroll: true }); }, 0);
    },
    // the bar under "Tap To Lobby", and the hint for this input
    refresh() {
      const a = G.Account ? G.Account.state() : { signedIn: false };
      $("start-name").textContent = a.signedIn ? a.name : T("account.guest");
      const uid = $("start-uid");
      uid.textContent = a.signedIn && a.uid ? T("start.uid", { uid: a.uid }) : "";
      uid.classList.toggle("hidden", !(a.signedIn && a.uid));
      $("btn-start-signin").classList.toggle("hidden", !!a.signedIn);
      const pad = G.Input && G.Input.padActive, touch = G.Input && G.Input.mode === "touch";
      $("start-hint").textContent = T(pad ? "start.hintPad" : touch ? "start.hintTouch" : "start.hintKeys");
    },
    key(e) {
      // Tab moves between "Tap To Lobby" and Sign In; Enter or Space on Sign
      // In signs in; any other key is the way in
      if (e.code === "Tab" || /^(Shift|Control|Alt|Meta)/.test(e.code) || e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return false;
      const f = document.activeElement;
      if (f && f.id === "btn-start-signin" && (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter")) { if (e.preventDefault) e.preventDefault(); this.signIn(); return true; }
      if (e.preventDefault) e.preventDefault();
      this.enter();
      return true;
    },
    signIn() {
      if (G.Account) G.Account.signIn(() => this.refresh());
    },

    enter() {
      if (!this.shown || this._leaving || G.Modal.top() && G.Modal.top().id !== "start") return;
      this._leaving = true;
      // (inside the tap or key press: iOS lets the sound start now)
      G.Audio.unlock();
      if (G.Audio.menuMusic) G.Audio.menuMusic(true);
      const el = $("start-screen");
      el.classList.add("leaving");
      G.Modal.close("start");
      setTimeout(() => {
        el.classList.add("hidden");
        el.classList.remove("leaving");
        this.shown = false; this._leaving = false;
        // a version found while the game was opening is offered now
        if (G.Updater) { G.Updater.badge(); if (G.Updater._offerLater) G.Updater.offer(G.Updater._offerM); }
      }, G.CONFIG.start.fadeMs);
    },
  };
})();
