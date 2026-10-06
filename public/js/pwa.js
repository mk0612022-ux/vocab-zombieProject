// ===================================================================
// Installable, and played sideways (A4)
// -------------------------------------------------------------------
// The service worker and updates are js/updater.js now (new series, round
// 1, C). What stays here: the "Rotate your device" card and the guards
// against pinch zoom. offer() / maybeShow() / later() are kept for the older
// tests: they ask the updater.
// ===================================================================
G.PWA = {
  init() {
    this.watchOrientation();
    this.guardGestures();
  },
  // a new version found: offered in the lobby (js/updater.js)
  offer() { if (G.Updater) G.Updater.offer(G.Updater.pending || G.Updater.installed || { version: "?" }); },
  maybeShow() { if (G.Updater && G.Updater._offerLater) G.Updater.offer(G.Updater._offerM); },
  later() { if (G.Dialog && G.Dialog.isOpen()) G.Dialog.close(); },
  // Phones and tablets are played sideways. Held upright, a card asking for
  // landscape covers the game (iOS ignores the manifest's orientation, and
  // a browser tab never had one); a run in progress goes to its pause menu
  // behind it, so turning back never drops the player straight into a
  // fight. The card is a window of G.Modal: it pauses everything, the
  // end-of-wave quiz's clock too, and swallows keys while it is up.
  watchOrientation() {
    const el = document.getElementById("rotate-overlay");
    if (!el || !window.matchMedia) return;
    const mq = window.matchMedia("(orientation: portrait)");
    const check = () => {
      const show = mq.matches && G.isHandheld();
      if (show === !!this.portrait) return;
      this.portrait = show;
      el.classList.toggle("hidden", !show);
      if (show) {
        const g = G.Game;
        if (g && g.state === "GAMEPLAY" && !G.Modal.pausesAll()) g.pause();
        G.Modal.open("rotate", { pause: true, keys: () => true });
      } else G.Modal.close("rotate");
    };
    if (mq.addEventListener) mq.addEventListener("change", check);
    else if (mq.addListener) mq.addListener(check);
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", () => setTimeout(check, 250));
    // (and once a second: an app on the iOS home screen can be late with all
    // of those after a turn, and a card left up would block the game)
    setInterval(check, 1000);
    check();
  },

  // iOS Safari ignores user-scalable=no in the viewport tag: its own pinch
  // events are cancelled here (touch-action in css/style.css stops double-tap
  // zoom, pull-to-refresh and the page's rubber band)
  guardGestures() {
    ["gesturestart", "gesturechange", "gestureend"].forEach((ev) =>
      document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
    document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  },
};
