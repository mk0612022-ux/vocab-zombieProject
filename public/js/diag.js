// ===================================================================
// What was happening (expansion, round 2)
// -------------------------------------------------------------------
// Always on and light, so that a report made after the fact has something to
// tell. Each is a ring of a fixed size (G.CONFIG.diag):
//   logs     console.*, which still reaches the real console
//   errors   window errors and rejected promises, with their stacks; the same
//            one again only counts
//   frames   the last frames' times, and each second of the last two minutes:
//            its FPS, its worst frame, its frames over 50 ms
// G.Bus keeps the last events itself. A frame costs a few writes into typed
// arrays and allocates nothing.
//
//   G.Diag.frame(ms)     from the game's loop
//   G.Diag.drawn(r)      from the game's loop, right after drawing
//   G.Diag.shot()        a promise: the next frame drawn as a JPEG data URL, or null
//   G.Diag.fps()         { avg, min, low1, slow, frames, seconds: [[fps, min, slow], ...] }
//   G.Diag.logs()  .errors()
//   G.Diag.onError       set by js/bugreport.js: the toast
//   G.Diag.timed         on: .costMs() is what a frame's bookkeeping takes (?debug=1)
// ===================================================================
window.G = window.G || {};

G.Diag = (function () {
  const C = G.CONFIG.diag, SLOW = C.slowMs;

  // ---------------- the console ----------------
  const logRing = new Array(C.logs);
  let logAt = 0, logN = 0;
  // one level of what was logged, a few items: a log line must cost next to
  // nothing, whatever it was given (an object may hold a whole scene)
  const one = (v) => (v && typeof v === "object" ? (Array.isArray(v) ? "[...]" : "{...}") : typeof v === "string" ? JSON.stringify(v.slice(0, 80)) : String(v));
  function piece(a) {
    if (typeof a === "string") return a;
    if (a instanceof Error) return a.stack || a.message;
    if (!a || typeof a !== "object") return String(a);
    if (Array.isArray(a)) return "[" + a.slice(0, 8).map(one).join(",") + (a.length > 8 ? ",..." : "") + "]";
    if (Object.getPrototypeOf(a) !== Object.prototype) return String(a);
    const keys = Object.keys(a);
    return "{" + keys.slice(0, 8).map((k) => JSON.stringify(k) + ":" + one(a[k])).join(",") + (keys.length > 8 ? ",..." : "") + "}";
  }
  function note(level, args) {
    let text = "";
    for (let i = 0; i < args.length; i++) text += (i ? " " : "") + piece(args[i]);
    logRing[logAt] = { t: Date.now(), level, text: text.slice(0, C.logChars) };
    logAt = (logAt + 1) % logRing.length;
    if (logN < logRing.length) logN++;
  }
  ["log", "info", "warn", "error", "debug"].forEach((level) => {
    const real = console[level];
    console[level] = function () {
      try { note(level, arguments); } catch (e) { /* the log must never break what logs */ }
      return real.apply(console, arguments);
    };
  });
  // oldest first
  function ring(r, at, n) { const out = []; for (let i = 0; i < n; i++) out.push(r[(at - n + i + r.length) % r.length]); return out; }

  // ---------------- errors ----------------
  const errors = [];
  function addError(kind, message, stack, where) {
    const text = String(message || "error");
    // (the browser's own note about a layout loop: no fault, and it comes often)
    if (/ResizeObserver loop/.test(text)) return;
    const same = errors.find((e) => e.message === text && e.stack === stack);
    if (same) { same.count++; same.last = Date.now(); }
    else {
      errors.push({ t: Date.now(), last: Date.now(), kind, message: text.slice(0, C.logChars), stack: String(stack || "").slice(0, 2000), where: where || "", count: 1 });
      if (errors.length > C.errors) errors.shift();
    }
    if (M.onError) { try { M.onError(); } catch (e) { /* see above */ } }
  }
  // (the capture phase: a file that failed to load comes this way too)
  window.addEventListener("error", (e) => {
    const t = e.target;
    if (t && t !== window && (t.src || t.href)) { addError("load", "failed to load " + String(t.src || t.href)); return; }
    addError("error", e.message, e.error && e.error.stack, e.filename ? e.filename.split("/").pop() + ":" + e.lineno + ":" + e.colno : "");
  }, true);
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    addError("rejection", r && r.message ? r.message : String(r), r && r.stack);
  });

  // ---------------- frames ----------------
  const times = new Float32Array(C.frames);
  const secFps = new Float32Array(C.seconds), secMin = new Float32Array(C.seconds), secSlow = new Uint16Array(C.seconds);
  let timeAt = 0, timeN = 0, secAt = 0, secN = 0, sum = 0, count = 0, worst = 0, slow = 0, cost = 0, costN = 0;
  function tick(ms) {
    times[timeAt] = ms;
    timeAt = (timeAt + 1) % times.length;
    if (timeN < times.length) timeN++;
    sum += ms; count++;
    if (ms > worst) worst = ms;
    if (ms > SLOW) slow++;
    if (sum < 1000) return;
    secFps[secAt] = count * 1000 / sum;
    secMin[secAt] = 1000 / worst;
    secSlow[secAt] = slow;
    secAt = (secAt + 1) % secFps.length;
    if (secN < secFps.length) secN++;
    sum = 0; count = 0; worst = 0; slow = 0;
  }
  function fps() {
    const n = timeN;
    if (!n) return { avg: 0, min: 0, low1: 0, slow: 0, frames: 0, seconds: [] };
    const a = Array.from(times.subarray(0, n)).sort((x, y) => y - x);
    const total = a.reduce((s, v) => s + v, 0), worstN = Math.max(1, Math.round(n * 0.01));
    const worstSum = a.slice(0, worstN).reduce((s, v) => s + v, 0);
    const round = (v) => Math.round(v * 10) / 10;
    const seconds = [];
    for (let i = 0; i < secN; i++) {
      const k = (secAt - secN + i + secFps.length) % secFps.length;
      seconds.push([round(secFps[k]), round(secMin[k]), secSlow[k]]);
    }
    return { avg: round(1000 * n / total), min: round(1000 / a[0]), low1: round(1000 * worstN / worstSum), slow: a.filter((v) => v > SLOW).length, frames: n, seconds };
  }

  // ---------------- a picture of the frame ----------------
  // The drawing buffer lives only until the frame is shown, so it is copied
  // right after drawing, into a canvas of its own that keeps it.
  let want = null;
  function shot() {
    if (want) return want.promise;
    const w = {};
    w.promise = new Promise((res) => { w.res = res; });
    want = w;
    setTimeout(() => { if (want === w) { want = null; w.res(null); } }, C.shotWaitMs);
    return w.promise;
  }
  function drawn(renderer) {
    if (!want) return;
    const w = want, src = renderer.domElement;
    want = null;
    try {
      const width = Math.min(C.shotWidth, src.width), c = document.createElement("canvas");
      c.width = width; c.height = Math.round(src.height * width / src.width);
      c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        if (!b) { w.res(null); return; }
        const f = new FileReader();
        f.onload = () => w.res(String(f.result));
        f.onerror = () => w.res(null);
        f.readAsDataURL(b);
      }, "image/jpeg", C.shotQuality);
    } catch (e) { w.res(null); }
  }

  const M = {
    onError: null,
    timed: false,
    // a frame's time, in ms. (A tab coming back after a while is no slow frame.)
    frame(ms) {
      if (!(ms > 0) || ms > 2000) return;
      if (!M.timed) { tick(ms); return; }
      const t0 = performance.now();
      tick(ms);
      cost += performance.now() - t0; costN++;
    },
    costMs: () => (costN ? cost / costN : 0),
    fps, shot, drawn,
    logs: () => ring(logRing, logAt, logN),
    errors: () => errors.slice(),
    addError,
  };
  return M;
})();
