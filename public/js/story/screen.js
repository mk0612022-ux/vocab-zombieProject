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
//   (round 7) calm / tense (music under a scene: the library's meeting, its defence) · quiet (the
//                                   music stopped) · (round 8) tick (a stopwatch running somewhere near, a second
//                                   at a time) / untick (no more of it) · (round 9) chimes (the school's bells: the
//                                   Westminster Quarters, public domain) · chime (the PA's two notes) · jingle (LEXA's
//                                   advertisement, cheerful) · bent (the same, broken, over and over) / unbent
//   ["shake", { sec, amp }]         the view shaken
//   (round 7) ["timer", { key, sec } | null]   a countdown at the top -- "Next wave in {n}" -- gone at 0
//   (round 9) timerHold(on): it stands still meanwhile (Kru Min down: js/story/pa.js)
//   ["thud", { at, n, gap }]        fists on a door, where it is: n blows, gap seconds apart
//   ["glass", { at, dir }]          a window's glass broken in, where it is (the sound, its shards)
//   ["card", { id, title, rows, mark, note }]   a card to read (the seating plan); closed: "card:<id>"
//   G.StoryScreen.update(game, dt) / reset() / state
// ===================================================================
window.G = window.G || {};

G.StoryScreen = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.screen) || {};
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  let black = null, title = null, hint = null, loops = {}, hintT = 0, titleT = 0;
  let timer = null, timerT = 0, timerKey = null, timerN = -1, timerHeld = false, thuds = [];       // (round 7)
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
    // (round 7) music under a scene: one at a time
    if (name === "calm" || name === "tense") { delete loops.calm; delete loops.tense; loops[name] = { t: 0, next: 0, i: 0 }; return; }
    if (name === "quiet") { delete loops.calm; delete loops.tense; return; }
    if (name === "tick") { loops.tick = { t: 0, next: 0, i: 0 }; return; }
    if (name === "untick") { delete loops.tick; return; }
    if (name === "bent") { loops.bent = { next: 0 }; return; }
    if (name === "unbent") { delete loops.bent; return; }
    if (!a) return;
    // (round 9) the school's bells, rung from the PA: two phrases of the Westminster Quarters (public domain)
    if (name === "chimes") { chimes(a); return; }
    if (name === "chime") { a.group({ cat: "sfx", prio: 2, pos: null, dur: 1.6 }, () => { bellNote(a, 659.3, 0, 0.05, 1.1); bellNote(a, 523.3, 0.42, 0.05, 1.3); }); return; }
    if (name === "jingle") { jingle(a, false); return; }
    if (name === "kick") a.group({ cat: "sfx", prio: 2, pos: null, dur: 0.6 }, () => {
      a.noise({ dur: 0.18, freq: 300, freqEnd: 80, q: 0.7, gain: 0.32 });
      a.noise({ dur: 0.09, freq: 2400, freqEnd: 900, q: 1.2, gain: 0.12, at: 0.02 });
      a.tone({ type: "triangle", freq: 120, freqEnd: 55, dur: 0.25, gain: 0.12 });
    });
    // (round 6) the crowd behind the glass: a chord that cuts in, low strings under it
    else if (name === "sting") a.group({ cat: "sfx", prio: 2, pos: null, dur: 1.8 }, () => {
      [233, 247, 349].forEach((f, i) => a.tone({ type: "sawtooth", freq: f, freqEnd: f * 0.97, dur: 1.4, gain: 0.035, at: i * 0.012, filter: { type: "lowpass", freq: 1800 } }));
      a.tone({ type: "sine", freq: 58, freqEnd: 46, dur: 1.6, gain: 0.12 });
      a.noise({ dur: 0.25, freq: 3000, freqEnd: 600, q: 0.8, gain: 0.08 });
    });
    // the crowbar in a door's gap: a creak, the frame giving, the leaf knocked free
    else if (name === "pry") a.group({ cat: "sfx", prio: 2, pos: null, dur: 1.2 }, () => {
      a.tone({ type: "sawtooth", freq: 140, freqEnd: 230, dur: 0.45, gain: 0.05, filter: { type: "bandpass", freq: 900, q: 4 } });
      a.noise({ dur: 0.12, freq: 1800, freqEnd: 500, q: 1.5, gain: 0.2, at: 0.46 });
      a.tone({ type: "square", freq: 880, freqEnd: 620, dur: 0.18, gain: 0.03, at: 0.47, filter: { type: "bandpass", freq: 2400, q: 6 } });
      a.tone({ type: "triangle", freq: 110, freqEnd: 60, dur: 0.3, gain: 0.12, at: 0.5 });
    });
    // a door swung open by hand, and one slammed
    else if (name === "door") a.group({ cat: "sfx", prio: 2, pos: null, dur: 0.9 }, () => {
      a.noise({ dur: 0.05, freq: 1400, freqEnd: 900, q: 2, gain: 0.08 });
      a.tone({ type: "sawtooth", freq: 320, freqEnd: 410, dur: 0.5, gain: 0.018, at: 0.05, filter: { type: "bandpass", freq: 1200, q: 8 } });
    });
    else if (name === "slam") a.group({ cat: "sfx", prio: 2, pos: null, dur: 0.6 }, () => {
      a.noise({ dur: 0.14, freq: 600, freqEnd: 120, q: 0.8, gain: 0.3 });
      a.tone({ type: "triangle", freq: 90, freqEnd: 50, dur: 0.22, gain: 0.14 });
    });
  }
  // (round 9) a bell's note: its partials, dying away
  function bellNote(a, f, at, gain, dur) {
    [[1, 1], [2.02, 0.42], [2.98, 0.2], [0.5, 0.4]].forEach(([k, g]) => a.tone({ type: "sine", freq: f * k, dur: dur / (k > 1 ? k * 0.8 : 1), gain: gain * g, at }));
    a.noise({ dur: 0.03, freq: 2600, freqEnd: 1800, q: 2, gain: gain * 0.35, at });
  }
  // the Westminster Quarters, two phrases of four (E major): the bells every school here has
  const WEST = [415.3, 370, 329.6, 246.9, 0, 329.6, 415.3, 370, 246.9];
  const CHIME_STEP = 0.5;
  function chimes(a) {
    a.group({ cat: "sfx", prio: 3, pos: null, dur: WEST.length * CHIME_STEP + 2 }, () => WEST.forEach((f, i) => { if (f) bellNote(a, f, i * CHIME_STEP, 0.085, 1.9); }));
  }
  // LEXA's advertisement: a tune of our own, six bright notes and a chord -- and the same one broken: the
  // notes sagging, one of them wrong, the last one stuck
  const JING = [[523.3, 0], [659.3, 0.16], [784, 0.32], [1046.5, 0.5], [880, 0.72], [1174.7, 0.9]];
  function jingle(a, bent) {
    a.group({ cat: "sfx", prio: bent ? 1 : 2, pos: null, dur: bent ? 4 : 1.9 }, () => {
      if (!bent) {
        JING.forEach(([f, at]) => { a.tone({ type: "triangle", freq: f, dur: 0.24, gain: 0.05, at }); a.tone({ type: "sine", freq: f * 2, dur: 0.16, gain: 0.014, at }); });
        [1046.5, 1318.5, 1568].forEach((f, i) => a.tone({ type: "sine", freq: f, dur: 0.8, gain: 0.022, at: 1.1 + i * 0.03 }));
        return;
      }
      const G0 = C().bentGain || 0.03;
      JING.forEach(([f, at], i) => a.tone({ type: "sawtooth", freq: f * (i === 3 ? 0.47 : 0.5), freqEnd: f * (i === 3 ? 0.36 : 0.44), dur: 0.55, gain: G0 * 0.6, at: at * 2.1, filter: { type: "lowpass", freq: 900 } }));
      for (let i = 0; i < 4; i++) a.tone({ type: "square", freq: 587 * 0.5, freqEnd: 520 * 0.5, dur: 0.14, gain: G0 * 0.35, at: 2.3 + i * 0.22, filter: { type: "bandpass", freq: 700, q: 2 } });
      a.noise({ dur: 0.5, freq: 1800, freqEnd: 1200, q: 0.7, gain: G0 * 0.4, at: 3.1 });
    });
  }
  // (round 6) a fist on the glass, where it is (js/story/cast.js: the crowd at the main stairs)
  function thud(pos) {
    const a = A();
    if (!a) return;
    a.group({ cat: "sfx", prio: 3, pos, dur: 0.4 }, () => {
      a.noise({ dur: 0.07, freq: 420 + Math.random() * 160, freqEnd: 140, q: 0.9, gain: 0.16, pos });
      a.tone({ type: "sine", freq: 1700 + Math.random() * 500, dur: 0.05, gain: 0.012, at: 0.01, pos });
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
    // (round 7) the meeting in the library: soft chords a few seconds apart, the room quiet round them
    const cm = loops.calm;
    if (cm) {
      cm.next -= dt;
      if (cm.next <= 0 && a) {
        cm.next = C().calmEvery || 4.8;
        const CH = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]], ch = CH[cm.i++ % CH.length];
        a.group({ cat: "music", prio: 1, pos: null, dur: 4.8 }, () => {
          ch.forEach((f, i) => a.tone({ type: i ? "triangle" : "sine", freq: f, dur: 4.4, gain: (C().calmGain || 0.016) * (i ? 0.7 : 1), attack: 1.1, at: i * 0.06 }));
          a.tone({ type: "sine", freq: ch[0] / 2, dur: 4.6, gain: (C().calmGain || 0.016) * 0.8, attack: 1.4 });
        });
      }
    }
    // ...and the defence: a low pulse, a held clash under it
    const tn = loops.tense;
    if (tn) {
      tn.next -= dt; tn.t += dt;
      if (tn.next <= 0 && a) {
        tn.next = C().tenseEvery || 0.85;
        const g0 = C().tenseGain || 0.07;
        a.group({ cat: "music", prio: 1, pos: null, dur: 0.5 }, () => a.tone({ type: "sine", freq: 58, freqEnd: 44, dur: 0.32, gain: g0 }));
        if ((tn.i++ % 4) === 0) a.group({ cat: "music", prio: 1, pos: null, dur: 3.4 }, () => {
          [110, 116.5].forEach((f) => a.tone({ type: "sawtooth", freq: f, dur: 3.2, gain: g0 * 0.22, attack: 0.6, filter: { type: "lowpass", freq: 520 } }));
        });
      }
    }
    // (round 8) a stopwatch running, close by: the chapter's sound (Coach Ek's, before he is seen)
    const tk = loops.tick;
    if (tk) {
      tk.next -= dt;
      if (tk.next <= 0 && a) {
        tk.next = C().tickEvery || 1;
        const hi = (tk.i++ % 2) === 0;
        a.group({ cat: "sfx", prio: 1, pos: null, dur: 0.1 }, () => a.tone({ type: "square", freq: hi ? 1750 : 1500, dur: 0.02, gain: C().tickGain || 0.05, filter: { type: "bandpass", freq: 2400, q: 3 } }));
      }
    }
    // (round 9) the PA machine playing LEXA's advertisement to itself, broken (the PR room until it is mended)
    const bt = loops.bent;
    if (bt) {
      bt.next -= dt;
      if (bt.next <= 0 && a) { bt.next = C().bentEvery || 9; jingle(a, true); }
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
  // (round 6) a card's parts, in this order: `plan` (a storey's evacuation plan, drawn from the
  // map), `lines` (in-world English -- a notice, a note on a locker, a photo's caption -- its
  // bank words to tap, its subtitle at the dialogue's level), `rows` (a table), `note`
  function card(game, run, o) {
    o = o || {};
    if (!G.Dialog) return;
    const v = G.Story.vars(), fill = (s) => String(s).replace(/\{name\}/g, v.name), D = G.StoryDialogue;
    let body = "";
    if (o.plan) body += planSvg(game, o.plan);
    if (o.lines && D) {
      if (D.ensure) D.ensure();                    // (its taps on a word: the dialogue's, on the window's body)
      body += o.lines.map((k) => { const text = D.en(k, v); return `<div class="story-card-line"><p class="scl-en">${D.mark(text)}</p>${D.subHtml(k, v, text, "scl-sub")}</div>`; }).join("");
    }
    if (o.rows) body += `<table class="story-card">${o.rows.map((r, i) => `<tr${i === o.mark ? ' class="sc-me"' : ""}>${r.map((c) => `<td>${esc(fill(G.STRINGS.en[c] != null ? G.STRINGS.en[c] : c))}</td>`).join("")}</tr>`).join("")}</table>`;
    if (o.note) body += `<p class="story-card-note">${esc(T(o.note, v))}</p>`;
    const done = () => { if (run && run.flags) run.flags.add("card:" + (o.id || "card")); };
    G.Dialog.open({ icon: o.icon || "📋", title: T(o.title || "story.card.title"), body, cls: o.plan ? "story-plan-dialog" : "", buttons: [{ label: T("dialog.ok"), primary: true, cancel: true, action: done }] });
  }
  // A storey's evacuation plan, as it hangs on the wall (north up, east right): the rooms with
  // their numbers, the corridors, the stairs, where the player stands, the way out in green.
  //   { storey: k, here: { x, z }, route: [[x, z], ...], exit: "E" }   (the map's own boxes:
  //   js/story/ch1map.js plan(k); its words the in-world English of the signs)
  function planSvg(game, p) {
    const M = game && game.world && game.world.storyMap, P = M && M.plan ? M.plan(p.storey) : null;
    if (!P) return "";
    const en = (k) => esc((G.STRINGS.en && G.STRINGS.en[k]) || k);
    const x0 = Math.min(P.main.x0, P.wing.x0) - 1.5, x1 = Math.max(P.main.x1, P.wing.x1) + 2.5, z0 = Math.min(P.main.z0, P.wing.z0) - 5, z1 = Math.max(P.main.z1, P.wing.z1) + 2.5;
    const R = (b, cls) => `<rect class="${cls}" x="${b.x0}" y="${b.z0}" width="${b.x1 + 1 - b.x0}" height="${b.z1 + 1 - b.z0}"/>`;
    const label = (x, z, t, cls, size) => `<text class="${cls || "pl-t"}" x="${x.toFixed(2)}" y="${z.toFixed(2)}" font-size="${size || 1.5}">${t}</text>`;
    const NAMES = { janitor: "story.sign.janitor", store: "story.sign.store", wc: "story.sign.wc" };
    let s = `<svg class="story-plan" viewBox="${x0} ${z0} ${x1 - x0} ${z1 - z0}" role="img" aria-label="${en("story.sign.evac1")}">`;
    s += `<rect class="pl-bg" x="${x0}" y="${z0}" width="${x1 - x0}" height="${z1 - z0}"/>`;
    s += label((x0 + x1) / 2, z0 + 2.6, en("story.sign.evac1"), "pl-title", 2.4);
    s += R(P.main, "pl-house") + R(P.wing, "pl-house");
    P.corridors.forEach((c) => { s += R(c, "pl-corr"); });
    P.rooms.forEach((r) => {
      if (r.open) return;                            // (a lobby: open to the corridor)
      s += R(r, "pl-room");
      const t = r.plate || (NAMES[r.type] ? en(NAMES[r.type]) : "");
      if (t) s += label((r.x0 + r.x1 + 1) / 2, (r.z0 + r.z1 + 1) / 2 + 0.55, esc(t), "pl-t", r.plate ? 1.6 : 1.05);
    });
    Object.keys(P.stairs).forEach((id) => {
      const c = P.stairs[id].cells, b = { x0: c.x[0], x1: c.x[1], z0: c.z[0], z1: c.z[1] };
      s += R(b, "pl-stairs" + (id === p.exit ? " pl-exit" : ""));
      const key = id === "M" ? "story.sign.mainStairs" : id === "E" ? "story.sign.evac3" : "story.sign.stairs";
      // (the main stairs' name and the way out's over their boxes -- the route's arrow ends in the
      // east stairwell's; the back stairs' in theirs)
      const over = id === "M" || id === p.exit;
      s += label((b.x0 + b.x1 + 1) / 2, over ? b.z0 - 0.6 : (b.z0 + b.z1 + 1) / 2 + 0.5, en(key), "pl-t pl-small" + (id === p.exit ? " pl-green" : ""), 1.1);
    });
    if (p.exit && P.stairs[p.exit]) { const c = P.stairs[p.exit].cells; s += label((c.x[0] + c.x[1] + 1) / 2, c.z[1] + 3.6, en("story.sign.emergencyExit"), "pl-t pl-green", 1.2); }
    if (p.route && p.route.length > 1) {
      s += `<defs><marker id="pl-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="pl-arrowhead"/></marker></defs>`;
      s += `<polyline class="pl-route" points="${p.route.map((q) => q[0] + "," + q[1]).join(" ")}" marker-end="url(#pl-arrow)"/>`;
    }
    if (p.here) {
      s += `<circle class="pl-here" cx="${p.here.x}" cy="${p.here.z}" r="1.1"/>`;
      s += label(p.here.x, p.here.z + 3.1, en("story.sign.evac2"), "pl-t pl-red", 1.2);
    }
    return s + "</svg>";
  }
  // ---------------- (round 7) a countdown, fists on a door, a window broken in ----------------
  function setTimer(o) {
    if (!timer) timer = el("story-timer", "story-timer");
    timerHold(false);
    if (!o) { timer.classList.add("hidden"); timerT = 0; timerKey = null; return; }
    o = typeof o === "number" ? { sec: o } : o;
    timer.classList.toggle("corner", !!o.corner);        // (round 9: out of the way of an answer's card -- a hold with a fight in it)
    timerKey = o.key || "story.timer.wave"; timerT = o.sec || 15; timerN = -1;
    timer.classList.remove("hidden");
    tickTimer(0);
  }
  function timerHold(on) { timerHeld = !!on; if (timer) timer.classList.toggle("held", timerHeld); }
  function tickTimer(dt) {
    if (!timerKey || timerHeld) return;
    timerT -= dt;
    if (timerT <= 0) { timer.classList.add("hidden"); timerKey = null; return; }
    const n = Math.ceil(timerT);
    if (n !== timerN) { timerN = n; timer.textContent = T(timerKey, { n }); if (n <= 3) { timer.classList.remove("tick"); void timer.offsetWidth; timer.classList.add("tick"); } }
  }
  function thudAt(o) {
    o = o || {};
    const p = o.at || {}, pos = new THREE.Vector3(p.x || 0, (Number.isFinite(p.y) ? p.y : 0) + 1.2, p.z || 0), n = Math.max(1, o.n | 0 || 3), gap = o.gap || 0.32;
    for (let i = 0; i < n; i++) thuds.push({ t: i * gap, pos, loud: true });
  }
  function tickThuds(dt) {
    for (let i = thuds.length - 1; i >= 0; i--) {
      const q = thuds[i];
      q.t -= dt;
      if (q.t > 0) continue;
      thuds.splice(i, 1);
      const a = A();
      if (a) a.group({ cat: "sfx", prio: 3, pos: q.pos, dur: 0.5 }, () => {
        a.noise({ dur: 0.12, freq: 260 + Math.random() * 120, freqEnd: 90, q: 0.8, gain: 0.34, pos: q.pos });
        a.tone({ type: "triangle", freq: 95, freqEnd: 52, dur: 0.18, gain: 0.12, pos: q.pos });
      });
    }
  }
  function glass(game, o) {
    o = o || {};
    const p = o.at || {}, pos = new THREE.Vector3(p.x || 0, Number.isFinite(p.y) ? p.y : 1.5, p.z || 0);
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("glass_break", { pos });
    // (its shards: the game's own chips of glass, a handful thrown in -- js/fx.js)
    const d = o.dir || { x: 0, z: -1 }, nrm = new THREE.Vector3(d.x || 0, 0, d.z || 0).normalize();
    if (G.FX && G.FX.impact) for (let i = 0; i < 4; i++) G.FX.impact({ point: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.8, 0)), normal: nrm, surface: "glass" });
    const pp = game && game.yawObject && game.yawObject.position;
    if (pp && Math.hypot(pp.x - pos.x, pp.z - pos.z) < 9) shake(game, { sec: 0.25, amp: 0.035 });
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
    tickTimer(dt);
    tickThuds(dt);
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
    if (timer) timer.classList.add("hidden");
    timerHold(false);
    hintT = 0; titleT = 0; objKey = null; timerT = 0; timerKey = null; thuds = [];
  }

  return { setBlack, showTitle, setHint, sound, thud, shake, card, planSvg, stopLoop, update, reset, setTimer, timerHold, thudAt, glass, WEST, CHIME_STEP,
    get state() { return { black: !!(black && black.classList.contains("on")), title: titleT > 0, hint: hintT > 0 ? (hint && hint.textContent) : "", loops: Object.keys(loops),
      timer: timerKey ? Math.ceil(timerT) : 0 }; } };
})();
