// ===================================================================
// Story Mode, chapter 1: "Escape the School" (docs/story/chapter1-design.pdf)
// -------------------------------------------------------------------
// The chapter as data for G.Story / G.StoryScenes (js/story/*.js). Story
// round 1 gives it its frame: the nine scenes with their titles and
// objectives, the chapter's words, and STAND-IN beats on a stand-in map (the
// Training Yard's, js/trainingyard.js) so that the shell -- scenes, zones,
// groups, checkpoints, Continue, Skip Prologue, the chapter's end -- can be
// played and tested. Story round 4 builds the chapter's own map and rounds
// 5-10 replace each scene's beats with the design's.
//
//   words.main     the 30 words of the chapter (the design's table). Only the
//                  ones the Master Word Bank has are used: a family form
//                  ("assessment") counts as its headword ("assess"); the ones
//                  the bank does not have yet (docs/story/words-draft.csv,
//                  waiting for the user's check) are left out until it does
//   words.golden   the four golden words (collectibles, story round 11)
//   zones          x/z boxes on the map (any height)
//   spawns         where a group comes from: a point, or a list of points
//   scenes         see js/story/scenes.js for what a beat can wait for and do
// ===================================================================
window.G = window.G || {};
G.STORY_CHAPTERS = G.STORY_CHAPTERS || {};
G.STORY_ORDER = ["ch1", "ch2"];

G.STORY_CHAPTERS.ch1 = {
  id: "ch1", n: 1, title: "story.ch1.title", next: "ch2",
  map: "training",                      // (stand-in: the Training Yard's map, until story round 4)
  words: {
    main: ["candidate", "proficiency", "scholarship", "invigilator", "sponsor", "verify", "assessment", "symptom",
      "emergency", "abandon", "opposite", "adjacent", "temporary", "barricade", "broadcast", "injury", "infection",
      "recover", "supply", "essential", "scarce", "announcement", "evacuate", "avoid", "assemble", "discipline",
      "trial", "side effect", "protect", "consequence"],
    golden: ["shortcut", "fluent", "integrity", "perseverance"],
  },
  // ---------------- stand-in places on the Training Yard's map ----------------
  zones: {
    yardFront: { x0: -15, x1: 15, z0: 4, z1: 20 },
    corridor: { x0: -3, x1: 3, z0: -16, z1: 2 },
    classroom: { x0: 3.5, x1: 15, z0: -16, z1: -4 },
    yardBack: { x0: -15, x1: 15, z0: 26, z1: 36 },
  },
  spawns: {
    yardFar: [{ x: -10, z: 33 }, { x: -5, z: 34.5 }, { x: 0, z: 35 }, { x: 5, z: 34.5 }, { x: 10, z: 33 }],
    corridorEnd: [{ x: -1.5, z: -14 }, { x: 1.5, z: -14 }, { x: 0, z: -12 }],
    classroomBack: [{ x: 13, z: -14 }, { x: 13, z: -6 }, { x: 8, z: -14 }],
    yardSide: [{ x: 12, z: 2 }, { x: -12, z: 8 }, { x: 12, z: 14 }],
  },
  // ---------------- the scenes (titles and objectives: the design's; beats: stand-ins) ----------------
  scenes: [
    { id: "prologue", title: "story.ch1.s0", objective: "story.ch1.s0.obj", prologue: true, noDeath: true, start: { x: 0, z: 32, yaw: 0 },
      beats: [
        { do: [["objective", "story.ch1.s0.obj"]] },
        { wait: { zone: "yardFront" }, do: [["banner", "story.ph.group"], ["spawn", { id: "p1", at: "yardFar", count: 3 }]] },
        { wait: { cleared: "p1" }, do: [["prologueDone"], ["checkpoint"], ["next"]] },
      ] },
    { id: "s1", title: "story.ch1.s1", objective: "story.ch1.s1.obj", start: { x: 0, z: 12, yaw: 0 },
      beats: [
        { do: [["objective", "story.ch1.s1.obj"]] },
        { wait: { zone: "corridor" }, do: [["banner", "story.ph.group"], ["spawn", { id: "c1", at: "corridorEnd", count: 3 }]] },
        { wait: { cleared: "c1" }, do: [["banner", "story.ph.clear"], ["checkpoint"], ["next"]] },
      ] },
    { id: "s2", title: "story.ch1.s2", objective: "story.ch1.s2.obj", start: { x: 0, z: -8, yaw: -Math.PI / 2 },
      beats: [
        { do: [["objective", "story.ch1.s2.obj"]] },
        { wait: { zone: "classroom" }, do: [["spawn", { id: "r1", at: "classroomBack", count: 2 }]] },
        { wait: { cleared: "r1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s3", title: "story.ch1.s3", objective: "story.ch1.s3.obj", start: { x: 9, z: -8, yaw: 0 },
      beats: [
        { do: [["objective", "story.ch1.s3.obj"], ["spawn", { id: "d1", at: "classroomBack", count: 2 }]] },
        { wait: { cleared: "d1" }, do: [["checkpoint", { x: 9, z: -8, yaw: 0 }], ["spawn", { id: "d2", at: "classroomBack", count: 3 }]] },
        { wait: { cleared: "d2" }, do: [["banner", "story.ph.clear"], ["checkpoint"], ["next"]] },
      ] },
    { id: "s4", title: "story.ch1.s4", objective: "story.ch1.s4.obj", start: { x: 0, z: -6, yaw: Math.PI },
      beats: [
        { do: [["objective", "story.ch1.s4.obj"]] },
        { wait: { zone: "yardFront" }, do: [["spawn", { id: "n1", at: "yardSide", count: 2 }]] },
        { wait: { cleared: "n1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s5", title: "story.ch1.s5", objective: "story.ch1.s5.obj", start: { x: 0, z: 18, yaw: Math.PI },
      beats: [
        { do: [["objective", "story.ch1.s5.obj"]] },
        { wait: { zone: "yardBack" }, do: [["banner", "story.ph.group"], ["spawn", { id: "f1", at: "yardFar", count: 4 }]] },
        { wait: { cleared: "f1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s6", title: "story.ch1.s6", objective: "story.ch1.s6.obj", start: { x: 0, z: 30, yaw: 0 },
      beats: [
        { do: [["objective", "story.ch1.s6.obj"]] },
        { wait: { zone: "corridor" }, do: [["spawn", { id: "h1", at: "corridorEnd", count: 3 }]] },
        { wait: { cleared: "h1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s7", title: "story.ch1.s7", objective: "story.ch1.s7.obj", start: { x: 0, z: -6, yaw: Math.PI },
      beats: [
        { do: [["objective", "story.ch1.s7.obj"]] },
        { wait: { zone: "yardFront" }, do: [["banner", "story.ph.group"], ["spawn", { id: "b1", at: "yardFar", count: 4 }]] },
        { wait: { cleared: "b1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s8", title: "story.ch1.s8", objective: "story.ch1.s8.obj", start: { x: 0, z: 20, yaw: 0 },
      beats: [
        { do: [["objective", "story.ch1.s8.obj"]] },
        { wait: { zone: "yardBack" }, do: [["end"]] },
      ] },
  ],
};

// chapter 2: named in the lobby only (coming in a later update)
G.STORY_CHAPTERS.ch2 = { id: "ch2", n: 2, title: "story.ch2.title", soon: true, scenes: [] };
