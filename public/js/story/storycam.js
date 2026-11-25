// ===================================================================
// Story Mode's camera (story series, round 2): first person, always
// -------------------------------------------------------------------
// The design never cuts away from the player's eyes. A cinematic moment is
// the view turned for them and held, the world slowed, black bars top and
// bottom -- not a camera of its own (the bosses' scenes have one,
// js/cutscene.js; its bars are borrowed here).
//   G.StoryCam.look(game, { x, y, z }, sec)    the view turns to face a point (eased)
//   G.StoryCam.lock(on)                         the mouse, the stick, a finger do not turn it
//   G.StoryCam.walk(game, { x, z }, { speed })  the player walks there by themselves (they can
//                                               look round unless it is locked)
//   G.StoryCam.bars(on)                         the black bars
//   G.StoryCam.slow(game, sec)                  the world at a third of its speed (Focus Time's,
//                                               js/game.js _slowmoT), the player not
//   (round 5) G.StoryCam.seat(game, { x, z, yaw } | false)   sat down there: the feet held, the
//                                               eyes lower (js/game.js reads drop); false: stood up
//   (round 8) G.StoryCam.fall(sec)   knocked off the feet (Coach Ek's charge): the eyes down near the
//                                               floor, the feet held, and up again
// Held (js/story/dialogue.js) a turn runs `fast` times as fast; a skipped cinematic part
// ends a turn and a walk where they were going (finish).
// js/game.js updatePlayerMovement asks steer() before it turns the view by the input, and
// feet() before it moves the player by it, while a chapter is played.
// ===================================================================
window.G = window.G || {};

G.StoryCam = (function () {
  const C = () => G.CONFIG.story.cam;
  let turn = null, locked = false, go = null, barsOn = false, seated = null, drop = 0, down = 0;
  const ease = (u) => u * u * (3 - 2 * u);
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  function look(game, p, sec) {
    const e = game.yawObject.position;
    const dx = p.x - e.x, dz = p.z - e.z, dy = (p.y == null ? e.y : p.y) - e.y;
    // (forward is (-sin yaw, -cos yaw): js/game.js)
    const yaw1 = Math.atan2(-dx, -dz), pitch1 = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.hypot(dx, dz) || 0.001)));
    const yaw0 = game.yawObject.rotation.y, pitch0 = game.pitchObject.rotation.x;
    turn = { yaw0, pitch0, dyaw: wrap(yaw1 - yaw0), dpitch: pitch1 - pitch0, t: 0, dur: Math.max(0.05, sec == null ? C().lookSec : sec) };
  }
  // js/game.js, a frame: true when the view is the story's (the look input is dropped)
  function steer(game, dt) {
    if (turn) {
      turn.t += dt * (G.StoryDialogue ? G.StoryDialogue.fast() : 1);
      const u = ease(Math.min(1, turn.t / turn.dur));
      game.yawObject.rotation.y = turn.yaw0 + turn.dyaw * u;
      game.pitchObject.rotation.x = turn.pitch0 + turn.dpitch * u;
      if (u >= 1) turn = null;
      return true;
    }
    return locked;
  }
  function lock(on) { locked = !!on; }
  function walk(game, p, opts) {
    const e = game.yawObject.position, d = Math.hypot(p.x - e.x, p.z - e.z);
    go = { x: p.x, z: p.z, speed: Math.max(0.2, Math.min(1, (opts && opts.speed) || 1)), t: 0, max: d / G.CONFIG.player.walkSpeed * 2.5 + 2 };
  }
  // js/game.js, a frame: the move input to use instead of the player's (their own frame:
  // x right, z back), or null
  function feet(game, dt) {
    // (round 5) seated: the eyes ease down (and back up when stood), the feet stay
    // (round 8) knocked down: the eyes drop fast, and come up as the time runs out
    if (down > 0) down = Math.max(0, down - dt);
    const want = down > 0.45 ? (C().fallDrop || 1.05) : seated ? (C().seatDrop || 0.48) : 0;
    const rate = down > 0.45 ? 6.5 : drop > (C().seatDrop || 0.48) ? 2.4 : 1.6;
    if (drop !== want) drop = want > drop ? Math.min(want, drop + dt * rate) : Math.max(want, drop - dt * rate);
    if (down > 0) return { x: 0, z: 0 };
    if (seated && !go) return { x: 0, z: 0 };
    if (!go) return null;
    go.t += dt;
    const e = game.yawObject.position, dx = go.x - e.x, dz = go.z - e.z, d = Math.hypot(dx, dz);
    // there (or stuck against something for too long): done
    if (d < 0.35 || go.t > go.max) { go = null; return { x: 0, z: 0 }; }
    const yaw = game.yawObject.rotation.y, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const ux = dx / d, uz = dz / d, k = go.speed * Math.min(1, d / 0.8 + 0.3);
    return { x: (-ux * fz + uz * fx) * k, z: -(ux * fx + uz * fz) * k };
  }
  function bars(on) { barsOn = !!on; document.body.classList.toggle("story-bars", barsOn); }
  function seat(game, p) {
    if (!p) { seated = null; return; }
    seated = { x: p.x, z: p.z };
    go = null;
    if (Number.isFinite(p.x) && Number.isFinite(p.z)) game.teleportPlayer(new THREE.Vector3(p.x, game.yawObject.position.y - 1.7 + drop, p.z));
    if (Number.isFinite(p.yaw)) game.yawObject.rotation.y = p.yaw;
  }
  function fall(sec) { down = Math.max(down, sec || 1.3); go = null; }
  function slow(game, sec) { game._slowmoT = Math.max(game._slowmoT || 0, sec == null ? 1.5 : sec); }
  // a skipped part: where it was all going, at once
  function finish(game) {
    if (turn) { game.yawObject.rotation.y = turn.yaw0 + turn.dyaw; game.pitchObject.rotation.x = turn.pitch0 + turn.dpitch; turn = null; }
    // (story round 4: on the storey the player is on -- a chapter's map has three)
    if (go) { game.teleportPlayer(new THREE.Vector3(go.x, game.yawObject.position.y - 1.7, go.z)); go = null; }
  }
  function busy() { return !!turn || !!go; }
  function reset() { turn = null; locked = false; go = null; seated = null; drop = 0; down = 0; bars(false); }

  return { look, steer, lock, walk, feet, bars, slow, seat, fall, finish, busy, reset,
    get turning() { return !!turn; }, get walking() { return !!go; }, get locked() { return locked; }, get barsOn() { return barsOn; },
    get seated() { return !!seated; }, get drop() { return drop; }, get fallen() { return down > 0; } };
})();
