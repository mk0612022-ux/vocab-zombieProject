// ===================================================================
// The phone (story series, round 2): messages, notifications, the torch
// -------------------------------------------------------------------
// The player's own phone, from the first scene's alarm to Kru Min's
// messages. What arrives is a scene's action (js/story/scenes.js):
//   G.StoryPhone.deliver(id)   a message from the chapter's `messages` (from a contact)
//   G.StoryPhone.notify(id)    a notification from its `notices` (the calendar, an ad)
// Either buzzes, shows a toast at the top (a tap opens it) and is kept as a
// flag ("msg:<id>", "ntf:<id>") -- so a checkpoint keeps the phone as it was.
//
//   T (Settings > Key bindings), the D-pad's up, or the phone button (touch): the phone, a
//   window (G.Modal, the world held): a tab for each conversation and the notifications,
//   the messages in English with their subtitles at the dialogue's level (their words can
//   be tapped), the torch, Close
//   L, the D-pad's down, or the torch button: the torch. Its light is a SpotLight a
//   chapter's light pool always has (G.Perf.torch, js/perf.js), off at intensity 0 -- so
//   switching it never changes the scene's light count (no shader is built again)
// ===================================================================
window.G = window.G || {};

G.StoryPhone = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => G.CONFIG.story.phone;
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const $ = (id) => document.getElementById(id);
  const P = new THREE.Vector3(), D = new THREE.Vector3();
  let el = null, toastEl = null, st = null;
  const beep = (list) => { const A = G.Audio; if (!A || !A.ctx || !A.group) return; A.group({ cat: "ui", prio: 1, pos: null, dur: 0.9 }, () => list.forEach((o) => A.tone(o))); };
  const ch = () => (G.Story && G.Story.run && G.Story.run.ch) || {};
  const run = () => G.Story && G.Story.run;

  // ---------------- a run ----------------
  // what the phone holds, rebuilt from the run's flags (a checkpoint's): in the order they came
  function start() {
    st = { msgs: [], notes: [], unread: {}, thread: null, torch: false, torchK: 0, toasts: [], toast: null, toastT: 0 };
    const r = run();
    if (r) r.flags.forEach((f) => {
      if (f.indexOf("msg:") === 0 && (ch().messages || {})[f.slice(4)]) st.msgs.push(f.slice(4));
      if (f.indexOf("ntf:") === 0 && (ch().notices || {})[f.slice(4)]) st.notes.push(f.slice(4));
    });
    buttons();
    badge();
  }
  function stop() {
    close();
    if (st) st.torch = false;
    if (G.Perf && G.Perf.torch) G.Perf.torch.intensity = 0;
    st = null;
    if (toastEl) toastEl.classList.add("hidden");
    document.body.classList.remove("torch-on");
  }

  // ---------------- what arrives ----------------
  function deliver(id) {
    const m = (ch().messages || {})[id], r = run();
    if (!m || !st || st.msgs.includes(id)) return false;
    st.msgs.push(id);
    st.unread[m.from] = (st.unread[m.from] || 0) + 1;
    if (r) r.flags.add("msg:" + id);
    toast({ thread: m.from, app: T(((ch().contacts || {})[m.from] || {}).name || "story.who." + m.from), text: G.StoryDialogue.en(m.text, m.vars) });
    badge();
    if (isOpen()) render();
    return true;
  }
  function notify(id) {
    const n = (ch().notices || {})[id], r = run();
    if (!n || !st || st.notes.includes(id)) return false;
    st.notes.push(id);
    st.unread["*"] = (st.unread["*"] || 0) + 1;
    if (r) r.flags.add("ntf:" + id);
    toast({ thread: "*", app: (n.icon ? n.icon + " " : "") + T(n.app || "story.phone.notes"), text: G.StoryDialogue.en(n.text, n.vars), own: true });
    badge();
    if (isOpen()) render();
    return true;
  }
  function unread() { return st ? Object.keys(st.unread).reduce((a, k) => a + st.unread[k], 0) : 0; }

  // ---------------- the toast at the top ----------------
  function toast(t) {
    st.toasts.push(t);
    if (!st.toast) nextToast();
    // the phone buzzes: two short low pulses (and its caption)
    beep([{ type: "square", freq: 92, dur: 0.12, gain: 0.05, filter: { type: "lowpass", freq: 400 } }, { type: "square", freq: 92, dur: 0.12, gain: 0.05, at: 0.2, filter: { type: "lowpass", freq: 400 } },
      { type: "sine", freq: 1568, dur: 0.08, gain: 0.025, at: 0.42 }]);
    if (G.Captions && G.Captions.on && G.Captions.on()) G.Captions.show("phone", "");
  }
  function nextToast() {
    st.toast = st.toasts.shift() || null; st.toastT = 0;
    if (!toastEl) {
      toastEl = document.createElement("button");
      toastEl.type = "button"; toastEl.id = "story-toast"; toastEl.className = "story-toast hidden";
      toastEl.addEventListener("click", () => { const t = st && st.toast; if (t) open(t.thread); });
      document.body.appendChild(toastEl);
    }
    if (!st.toast) { toastEl.classList.add("hidden"); return; }
    const I = G.Input, kb = G.save.settings.keybinds;
    const key = I.padActive ? T("story.phone.padKey") : I.mode === "touch" ? "" : G.keyLabel(kb.phone);
    const text = st.toast.text.length > 70 ? st.toast.text.slice(0, 68) + "…" : st.toast.text;
    // (a message: the phone's icon and who wrote; a notification: its app's own icon)
    toastEl.innerHTML = `<span class="st-app">${st.toast.own ? "" : "📱 "}${esc(st.toast.app)}</span><span class="st-text">${esc(text)}</span>${key ? `<span class="st-key">${esc(T("story.phone.openKey", { key }))}</span>` : ""}`;
    toastEl.classList.remove("hidden", "in"); void toastEl.offsetWidth; toastEl.classList.add("in");
  }

  // ---------------- the window ----------------
  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "story-phone"; el.className = "story-phone hidden";
    el.innerHTML = `<div class="sp-box" id="story-phone-box" role="dialog" aria-modal="true" aria-labelledby="sp-title">`
      + `<div class="sp-status"><span id="sp-clock"></span><b class="sp-title" id="sp-title"></b><span class="sp-batt" aria-hidden="true">87%</span></div>`
      + `<div class="sp-tabs" id="sp-tabs" role="tablist"></div><div class="sp-body" id="sp-body"></div>`
      + `<div class="sp-bar"><button type="button" class="btn sp-torch" id="sp-torch"></button><button type="button" class="btn sp-close" id="sp-close" data-pad-back></button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      const w = e.target.closest(".sd-word");
      if (w) {
        const en = G.WordBank.byId(w.dataset.id); if (en && G.VocabCard) G.VocabCard.peek(G.WordBank.pairOf(en), w.dataset.form, { freeze: true });
        const r = run(); if (r && !r.flags.has("tapped")) { r.flags.add("tapped"); const tip = el.querySelector(".sp-tip"); if (tip) tip.remove(); }   // (round 5: the tip has been taken)
        return;
      }
      const tab = e.target.closest("[data-thread]");
      if (tab) { pick(tab.dataset.thread); return; }
      if (e.target.closest("#sp-torch")) { torch(); return; }
      if (e.target.closest("#sp-close") || e.target === el) close();
    });
    return el;
  }
  function threads() {
    const out = [];
    st.msgs.forEach((id) => { const f = ch().messages[id].from; if (!out.includes(f)) out.push(f); });
    if (st.notes.length) out.push("*");
    return out;
  }
  function pick(thread) {
    st.thread = thread;
    st.unread[thread] = 0;
    st.toasts = st.toasts.filter((t) => t.thread !== thread);       // (story round 5: read: its queued toasts go)
    read(thread);
    badge();
    render();
  }
  // a conversation opened: the scene can wait for it ({ read: contact }, js/story/scenes.js)
  function read(thread) { const r = run(); if (r && thread) r.flags.add("read:" + thread); }
  function open(thread) {
    if (!st || !G.Game.playing() && !isOpen()) return false;
    ensure();
    const list = threads();
    st.thread = thread && list.includes(thread) ? thread : (list.find((t) => st.unread[t] > 0) || list[0] || null);
    if (st.thread) { st.unread[st.thread] = 0; read(st.thread); }
    // (the window first: once it shows, isOpen() is true -- the G.Modal is what holds the world and takes the keys)
    if (!G.Modal.isOpen("story-phone")) G.Modal.open("story-phone", { freeze: true, keys });
    el.classList.remove("hidden");
    // (story round 5: the conversation read, none of its toasts still queued pops up later)
    st.toasts = st.toasts.filter((t) => t.thread !== st.thread);
    if (st.toast && st.toast.thread === st.thread) nextToast();
    render();
    badge();
    beep([{ type: "sine", freq: 660, freqEnd: 880, dur: 0.08, gain: 0.03 }]);
    if (G.Input.mode !== "touch") setTimeout(() => { const b = el.querySelector(".sp-tab.on") || $("sp-close"); if (b && isOpen()) b.focus({ preventScroll: true }); }, 0);
    // (story round 5: the phone's alarm -- the prologue's first sound -- stops once it is picked up)
    if (G.StoryScreen && G.StoryScreen.stopLoop) G.StoryScreen.stopLoop("alarm");
    return true;
  }
  function close() {
    if (!el || el.classList.contains("hidden")) { if (G.Modal.isOpen("story-phone")) G.Modal.close("story-phone"); return; }
    el.classList.add("hidden");
    G.Modal.close("story-phone");
  }
  function isOpen() { return !!el && !el.classList.contains("hidden"); }
  function toggle() { return isOpen() ? (close(), false) : open(); }
  function keys(e) {
    const kb = G.save.settings.keybinds;
    if (e.code === "Escape" || (kb.phone && e.code === kb.phone)) { close(); return true; }
    if (kb.flashlight && e.code === kb.flashlight) { torch(); return true; }
    const list = threads(), i = list.indexOf(st.thread);
    if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && list.length) { pick(list[(i + (e.code === "ArrowLeft" ? -1 : 1) + list.length) % list.length]); return true; }
    const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (n && list[+n[1] - 1]) { pick(list[+n[1] - 1]); return true; }
    return true;
  }
  function render() {
    if (!el || !st) return;
    const D = G.StoryDialogue, list = threads();
    const sc = run() && run().scene;
    $("sp-clock").textContent = (sc && sc.clock) || "";
    $("sp-title").textContent = T("story.phone.title");
    $("sp-tabs").innerHTML = list.map((t, i) => {
      const name = t === "*" ? T("story.phone.notes") : T(((ch().contacts || {})[t] || {}).name || "story.who." + t);
      const n = st.unread[t] || 0;
      return `<button type="button" role="tab" class="sp-tab${t === st.thread ? " on" : ""}" data-thread="${esc(t)}" aria-selected="${t === st.thread}">${esc(name)}${n ? `<span class="sp-n">${n}</span>` : ""}<span class="kbd-only dlg-key"> (${i + 1})</span></button>`;
    }).join("");
    let body = "";
    if (!st.thread) body = `<p class="sp-empty">${esc(T("story.phone.empty"))}</p>`;
    else if (st.thread === "*") body = st.notes.map((id) => { const n = ch().notices[id], text = D.en(n.text, n.vars); return `<div class="sp-note"><span class="sp-app">${esc((n.icon ? n.icon + " " : "") + T(n.app || "story.phone.notes"))}</span><div class="sp-text">${D.mark(text)}</div>${D.subHtml(n.text, n.vars, text, "sp-sub")}</div>`; }).join("");
    else body = st.msgs.filter((id) => ch().messages[id].from === st.thread).map((id) => { const m = ch().messages[id], text = D.en(m.text, m.vars); return `<div class="sp-msg"><div class="sp-text">${D.mark(text)}</div>${D.subHtml(m.text, m.vars, text, "sp-sub")}</div>`; }).join("");
    // (story round 5) the dotted words taught where they are: a line under the thread while it has
    // any (the bank's words in its messages), until one has been looked at
    const r = run();
    if (/sd-word/.test(body) && r && !r.flags.has("tapped")) {
      const I = G.Input, key = I.padActive ? "story.hint.words.pad" : I.mode === "touch" ? "story.hint.words.touch" : "story.hint.words";
      body += `<p class="sp-tip">${esc(T(key))}</p>`;
    }
    const b = $("sp-body");
    b.innerHTML = body;
    b.scrollTop = b.scrollHeight;
    $("sp-torch").textContent = "🔦 " + T(st.torch ? "story.phone.torchOn" : "story.phone.torchOff");
    $("sp-torch").setAttribute("aria-pressed", String(st.torch));
    const kb = G.save.settings.keybinds;
    $("sp-close").innerHTML = esc(T("story.phone.close")) + (kb.phone ? `<span class="kbd-only dlg-key"> (${esc(G.keyLabel(kb.phone))})</span>` : "");
  }
  function refresh() { if (isOpen()) render(); if (st && st.toast) nextToast(); }

  // ---------------- the torch ----------------
  function torch(v) {
    if (!st) return false;
    const want = v == null ? !st.torch : !!v;
    if (want !== st.torch) {
      st.torch = want;
      beep([{ type: "square", freq: want ? 2400 : 1900, dur: 0.018, gain: 0.05, filter: { type: "bandpass", freq: 2600, q: 3 } }]);
      document.body.classList.toggle("torch-on", want);
      if (isOpen()) render();
    }
    return st.torch;
  }
  function update(game, dt) {
    if (!st) return;
    const L = G.Perf && G.Perf.torch, cfg = C().torch;
    if (L && game.camera) {
      st.torchK += ((st.torch ? 1 : 0) - st.torchK) * Math.min(1, dt * 14);
      if (st.torchK < 0.002) st.torchK = 0;
      // in the right hand: a little to the side and below the eyes, lighting where they look
      game.camera.getWorldPosition(P); game.camera.getWorldDirection(D);
      L.position.set(P.x + D.z * 0.18, P.y - 0.2, P.z - D.x * 0.18);
      L.target.position.set(P.x + D.x * 9, P.y + D.y * 9, P.z + D.z * 9);
      L.target.updateMatrixWorld();
      L.intensity = cfg.intensity * st.torchK;
    }
    if (st.toast) { st.toastT += dt; if (st.toastT >= C().toastSec) nextToast(); }
  }

  // ---------------- touch: the phone and the torch on the screen ----------------
  function buttons() {
    const tc = $("touch-controls");
    if (!tc) return;
    if (!$("touch-phone")) {
      tc.insertAdjacentHTML("beforeend", `<button id="touch-phone" class="touch-btn touch-story touch-phone icon-btn" type="button"><span class="tb-emo" aria-hidden="true">📱</span><span class="tb-badge hidden" id="touch-phone-badge"></span></button>`
        + `<button id="touch-torch" class="touch-btn touch-story touch-torch icon-btn" type="button"><span class="tb-emo" aria-hidden="true">🔦</span></button>`);
      const bind = (id, fn) => { const b = $(id); b.addEventListener("touchstart", (e) => { e.preventDefault(); if (G.touchFeedback) G.touchFeedback(b, false); fn(); }, { passive: false }); };
      bind("touch-phone", () => toggle());
      bind("touch-torch", () => torch());
    }
    $("touch-phone").setAttribute("aria-label", T("story.phone.title"));
    $("touch-torch").setAttribute("aria-label", T("story.phone.torch"));
  }
  function badge() {
    const b = $("touch-phone-badge"), n = unread();
    if (b) { b.textContent = n > 9 ? "9+" : String(n); b.classList.toggle("hidden", !n); }
  }

  return { start, stop, deliver, notify, open, close, toggle, isOpen, torch, update, refresh, unread, threads: () => (st ? threads() : []),
    get state() { return st; } };
})();
