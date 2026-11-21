// ===================================================================
// A scene's moments on the screen and in the ears (story series, round 5)
// -------------------------------------------------------------------
// The prologue opens on a black screen and an alarm, has a fire alarm, a
// radio, a door kicked open, and ends on the chapter's title; it also says,
// a line at a time, what each new thing is for (how to look round on this
// device, what the button is). A scene's actions (js/story/scenes.js):
//   ["black", { on, sec }]          the screen black (the phone, its toasts and the lines over it), faded
//   ["title", { key, sub, sec }]    the chapter's title across the screen (English, the subtitle
//                                   in the menus' language under it), faded in and out
//   ["sound", name]                 alarm (the phone's, until "stop" or the phone is opened) ·
//                                   bell (the fire alarm, ringing on) · kick (a door burst open) ·
//                                   static (the radio's hiss, a while) · stop (every loop)
//   ["hint", key | { key, bind, sec } | null]   a line at the bottom on what to do: the key's
//                                   ".touch" or ".pad" form when the player plays that way, {key}
//                                   the binding of `bind`
//   ["shake", { sec, amp }]         the view shaken
//   ["card", { id, title, rows, mark, note }]   a card to read (the seating plan); closed: "card:<id>"
//   G.StoryScreen.update(game, dt) / reset() / state
// ===================================================================
window.G = window.G || {};

G.StoryScreen = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.screen) || {};
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  let black = null, title = null, hint = null, loops = {}, hintT = 0, titleT = 0;
  const A = () => (G.Audio && G.Audio.ctx && G.Audio.group ? G.Audio : null);

  function el(id, cls, html) {
    const e = document.createElement("div");
    e.id = id; e.className = cls + " hidden";
    if (html) e.innerHTML = html;
    document.body.appendChild(e);
    return e;
  }
  // ---------------- black ----------------
  function setBlack(o) {
    o = typeof o === "object" && o ? o : { on: !!o };
    if (!black) black = el("story-black", "story-black");
    black.style.transitionDuration = (o.sec != null ? o.sec : (C().fadeSec || 1.2)) + "s";
    if (o.on) { black.classList.remove("hidden"); void black.offsetWidth; black.classList.add("on"); }
    else { black.classList.remove("on"); clearTimeout(black._t); black._t = setTimeout(() => { if (!black.classList.contains("on")) black.classList.add("hidden"); }, (o.sec != null ? o.sec : 1.2) * 1000 + 50); }
    document.body.classList.toggle("story-black-on", !!o.on);
  }
  // ---------------- the title ----------------
  function showTitle(o) {
    o = typeof o === "string" ? { key: o } : o || {};
    if (!title) title = el("story-title", "story-title");
    const en = (k) => (G.STRINGS.en[k] != null ? G.STRINGS.en[k] : k);
    const main = en(o.key || "story.title.brand"), sub = o.sub ? en(o.sub) : "";
    const local = o.sub && G.lang !== "en" ? T(o.sub) : "";
    title.innerHTML = `<div class="stt-main">${esc(main)}</div>${sub ? `<div class="stt-sub">${esc(sub)}</div>` : ""}${local && local !== sub ? `<div class="stt-local" lang="${esc(G.lang)}">${esc(local)}</div>` : ""}`;
    title.classList.remove("hidden", "out"); void title.offsetWidth; title.classList.add("in");
    titleT = o.sec || C().titleSec || 4.2;
    const a = A();
    if (a) a.group({ cat: "music", prio: 2, pos: null, dur: 3 }, () => {
      [196, 247, 294, 392].forEach((f, i) => a.tone({ type: "triangle", freq: f, dur: 2.2 - i * 0.3, gain: 0.035, at: i * 0.18 }));
      a.tone({ type: "sine", freq: 98, dur: 2.6, gain: 0.05 });
    });
  }
  // ---------------- a line on what to do ----------------
  function setHint(o) {
    if (!hint) hint = el("story-hint", "story-hint");
    if (!o) { hint.classList.add("hidden"); hintT = 0; return; }
    o = typeof o === "string" ? { key: o } : o;
    const I = G.Input, kb = G.save.settings.keybinds, has = (k) => G.STRINGS.en[k] != null;
    let key = o.key;
    if (I.padActive && has(key + ".pad")) key += ".pad";
    else if (I.mode === "touch" && has(key + ".touch")) key += ".touch";
    const bind = o.bind && kb[o.bind] ? G.keyLabel(kb[o.bind]) : "";
    hint.textContent = T(key, { key: bind });
    hint.classList.remove("hidden"); hint.classList.remove("in"); void hint.offsetWidth; hint.classList.add("in");
    hintT = o.sec || C().hintSec || 6;
  }
  // ---------------- sounds ----------------
  function sound(name) {
    const a = A();
    if (name === "stop") { loops = {}; return; }
    if (name === "alarm" || name === "bell") { loops[name] = { t: 0, next: 0 }; return; }
    if (name === "static") { loops.static = { t: 0, next: 0, left: C().staticSec || 9 }; return; }
    if (!a) return;
    if (name === "kick") a.group({ cat: "sfx", prio: 2, pos: null, dur: 0.6 }, () => {
      a.noise({ dur: 0.18, freq: 300, freqEnd: 80, q: 0.7, gain: 0.32 });
      a.noise({ dur: 0.09, freq: 2400, freqEnd: 900, q: 1.2, gain: 0.12, at: 0.02 });
      a.tone({ type: "triangle", freq: 120, freqEnd: 55, dur: 0.25, gain: 0.12 });
    });
  }
  // a loop stopped (the phone picked up: js/story/phone.js open -- the world is held while it is)
  function stopLoop(name) { delete loops[name]; }
  function tickLoops(dt) {
    const a = A();
    // the phone's alarm: three beeps, a breath, again -- until the phone is opened
    const al = loops.alarm;
    if (al) {
      al.t += dt; al.next -= dt;
      if (al.next <= 0 && a) {
        al.next = 1.05;
        a.group({ cat: "ui", prio: 1, pos: null, dur: 0.8 }, () => [0, 0.16, 0.32].forEach((at) => { a.tone({ type: "square", freq: 1320, dur: 0.07, gain: 0.03, at, filter: { type: "lowpass", freq: 3200 } }); a.tone({ type: "sine", freq: 2640, dur: 0.06, gain: 0.012, at }); }));
      }
    }
    // the fire alarm: a bell's hammer, a second at a time
    const bl = loops.bell;
    if (bl) {
      bl.next -= dt;
      if (bl.next <= 0 && a) {
        bl.next = 1.5;
        a.group({ cat: "sfx", prio: 2, pos: null, dur: 1.3 }, () => {
          for (let i = 0; i < 18; i++) { const at = i * 0.062; a.tone({ type: "square", freq: 760, dur: 0.045, gain: 0.018, at, filter: { type: "bandpass", freq: 1500, q: 3 } }); a.tone({ type: "sine", freq: 2280, dur: 0.04, gain: 0.008, at }); }
        });
      }
    }
    // the radio: a hiss in bursts
    const st = loops.static;
    if (st) {
      st.left -= dt; st.next -= dt;
      if (st.left <= 0) delete loops.static;
      else if (st.next <= 0 && a) { st.next = 0.45; a.group({ cat: "sfx", prio: 1, pos: null, dur: 0.5 }, () => a.noise({ dur: 0.42, freq: 2200, freqEnd: 1800, q: 0.6, gain: 0.025 })); }
    }
  }
  // ---------------- a card to read (the seating plan) ----------------
  // { id, icon, title (a key), rows: [[cell, cell, ...]] -- "{name}" the candidate's -- mark: the
  // row to light (the player's own), note }: G.Dialog's window, the world held; closed: "card:<id>"
  function card(game, run, o) {
    o = o || {};
    if (!G.Dialog) return;
    const v = G.Story.vars(), fill = (s) => String(s).replace(/\{name\}/g, v.name);
    const rows = (o.rows || []).map((r, i) => `<tr${i === o.mark ? ' class="sc-me"' : ""}>${r.map((c) => `<td>${esc(fill(G.STRINGS.en[c] != null ? G.STRINGS.en[c] : c))}</td>`).join("")}</tr>`).join("");
    const body = `<table class="story-card">${rows}</table>${o.note ? `<p class="story-card-note">${esc(T(o.note, v))}</p>` : ""}`;
    const done = () => { if (run && run.flags) run.flags.add("card:" + (o.id || "card")); };
    G.Dialog.open({ icon: o.icon || "📋", title: T(o.title || "story.card.title"), body, buttons: [{ label: T("dialog.ok"), primary: true, cancel: true, action: done }] });
  }
  function shake(game, o) {
    o = typeof o === "number" ? { sec: o } : o || {};
    game._shakeT = Math.max(game._shakeT || 0, o.sec || 0.35);
    game._shakeA = Math.max(game._shakeA || 0, o.amp || 0.05);
  }

  // the objective before the glasses are on (their word box shows it after): a line at the top
  let obj = null, objKey = null;
  function tickObjective() {
    const r = G.Story && G.Story.run, key = r && !r.over ? r.objective || null : null;
    if (key === objKey) return;
    objKey = key;
    if (!obj) obj = el("story-obj", "story-obj");
    obj.textContent = key ? T(key, G.Story.vars()) : "";
    obj.classList.toggle("hidden", !key);
    if (key) { obj.classList.remove("in"); void obj.offsetWidth; obj.classList.add("in"); }
  }
  function update(game, dt) {
    tickLoops(dt);
    tickObjective();
    if (hintT > 0) { hintT -= dt; if (hintT <= 0 && hint) hint.classList.add("hidden"); }
    if (titleT > 0) { titleT -= dt; if (titleT <= 0 && title) { title.classList.remove("in"); title.classList.add("out"); setTimeout(() => { if (title && titleT <= 0) title.classList.add("hidden"); }, 900); } }
  }
  function reset() {
    loops = {};
    if (black) { black.classList.remove("on"); black.classList.add("hidden"); }
    document.body.classList.remove("story-black-on");
    if (title) title.classList.add("hidden");
    if (hint) hint.classList.add("hidden");
    if (obj) obj.classList.add("hidden");
    hintT = 0; titleT = 0; objKey = null;
  }

  return { setBlack, showTitle, setHint, sound, shake, card, stopLoop, update, reset,
    get state() { return { black: !!(black && black.classList.contains("on")), title: titleT > 0, hint: hintT > 0 ? (hint && hint.textContent) : "", loops: Object.keys(loops) }; } };
})();
