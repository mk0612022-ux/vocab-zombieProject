// ===================================================================
// Zombies whispering their words (story series, round 6: from scene 1-1 on)
// -------------------------------------------------------------------
// The design: every zombie mutters the word on its own label, so the player
// hears how it is said while they fight -- a caption shows it: [whisper:
// "abandon"]. The nearest one with a word, within `whisper.range`, a word at
// a time: never over a line being said or a word the player asked to hear
// (G.Audio.speak's whisper never cuts in), a zombie no more often than every
// `zombieGap` seconds, the chapter no more often than every `gap`. No voice
// on the device (or the speech volume at 0): the caption alone.
//   G.StoryWhisper.update(game, dt) / reset() / last
//   (story round 8) G.StoryWhisper.show(text)   a shout as a caption: Coach Ek's, after the first
//   (story round 9) show(text, sec, cls)        for that long, with a class of its own (the PA's loop)
// ===================================================================
window.G = window.G || {};

G.StoryWhisper = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.whisper) || {};
  let t = 0, el = null, capT = 0, last = null, own = null;
  const heard = new WeakMap();                 // zombie -> when it last whispered

  const caption = (word) => show(T("story.whisper", { word }));
  function show(text, sec, cls) {
    if (!el) {
      if (G.StoryDialogue && G.StoryDialogue.ensure) G.StoryDialogue.ensure();       // (its box first: a line up hides a caption under it -- css)
      el = document.createElement("div");
      el.id = "story-whisper"; el.className = "story-whisper hidden";
      el.setAttribute("aria-hidden", "true");      // (its word is on the zombie's label already)
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.className = "story-whisper" + (cls ? " " + cls : ""); void el.offsetWidth; el.classList.add("in");
    capT = sec || C().captionSec || 1.8;
    own = cls || null;
  }
  function update(game, dt) {
    if (capT > 0) { capT -= dt; if (capT <= 0 && el) { el.classList.add("hidden"); own = null; } }
    if (C().on === false || !game || game.mode !== "story" || game.state !== "GAMEPLAY" || game.paused) return;
    if (own && capT > 0) return;                  // (round 9: the PA's announcement being read: nothing over it)
    t += dt;
    if (t < (C().gap || 2.6)) return;
    // (never over a line, a turn of the camera, the lock or the phone)
    if ((G.StoryDialogue && G.StoryDialogue.busy()) || G.Modal.isOpen() || (G.StoryLock && G.StoryLock.holds())) return;
    const p = game.yawObject.position, r = C().range || 6.5, gapZ = C().zombieGap || 7, now = performance.now() / 1000;
    let best = null, bd = r;
    game.zombies.forEach((z) => {
      if (!z.alive || !z.mesh || !z.word || z.decoy) return;
      const d = Math.hypot(z.mesh.position.x - p.x, z.mesh.position.z - p.z);
      if (d >= bd || Math.abs(z.mesh.position.y - (p.y - 1.7)) > 2.2) return;
      if (now - (heard.get(z) || -99) < gapZ) return;
      best = z; bd = d;
    });
    if (!best) return;
    t = 0;
    heard.set(best, now);
    last = { word: best.word, at: now };
    caption(best.word);
    if (G.Audio && G.Audio.speak) G.Audio.speak(best.word, { whisper: true, lang: G.Lang ? G.Lang.wl(best.pair || [best.word]) : "en" });
  }
  function reset() { t = 0; capT = 0; last = null; own = null; if (el) el.classList.add("hidden"); }

  return { update, reset, show, get last() { return last; } };
})();
