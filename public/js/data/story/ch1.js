// ===================================================================
// Story Mode, chapter 1: "Escape the School" (docs/story/chapter1-design.pdf)
// -------------------------------------------------------------------
// The chapter as data for G.Story / G.StoryScenes (js/story/*.js). Story
// round 1 gave it its frame: the nine scenes with their titles and
// objectives, the chapter's words, and STAND-IN beats so the shell -- scenes,
// zones, groups, checkpoints, Continue, Skip Prologue, the chapter's end --
// can be played and tested. Round 4 puts it on its own map, the school of
// blocks (js/story/ch1map.js): every scene starts where the design has it,
// with its time of day (`light`, js/story/storylight.js); rounds 5-10
// replace each scene's beats with the design's.
//
//   words.main     the 30 words of the chapter (the design's table). Only the
//                  ones the Master Word Bank has are used: a family form
//                  ("assessment") counts as its headword ("assess"); the ones
//                  the bank does not have yet (docs/story/words-draft.csv,
//                  waiting for the user's check) are left out until it does
//   words.golden   the four golden words (collectibles, story round 11)
//   zones          x/z boxes on the map, `y` the storey's floor (0, 4, 8)
//   spawns         where a group comes from: a point, or a list of points (with y)
//   scenes         see js/story/scenes.js for what a beat can wait for and do
// ===================================================================
window.G = window.G || {};
G.STORY_CHAPTERS = G.STORY_CHAPTERS || {};
G.STORY_ORDER = ["ch1", "ch2"];

G.STORY_CHAPTERS.ch1 = {
  id: "ch1", n: 1, title: "story.ch1.title", next: "ch2",
  map: "ch1", theme: "training",        // (round 4: the chapter's school -- js/story/ch1map.js; daylight's palette)
  words: {
    main: ["candidate", "proficiency", "scholarship", "invigilator", "sponsor", "verify", "assessment", "symptom",
      "emergency", "abandon", "opposite", "adjacent", "temporary", "barricade", "broadcast", "injury", "infection",
      "recover", "supply", "essential", "scarce", "announcement", "evacuate", "avoid", "assemble", "discipline",
      "trial", "side effect", "protect", "consequence"],
    golden: ["shortcut", "fluent", "integrity", "perseverance"],
  },
  // ---------------- places on the chapter's map (round 4) ----------------
  // 1F y 0 · 2F y 4 · 3F y 8 (js/story/ch1map.js: the rooms' cells)
  zones: {
    entry: { x0: 1, x1: 8, z0: 3, z1: 9, y: 0 },                // the entrance hall
    corridor3East: { x0: 8, x1: 24, z0: -2, z1: 2, y: 8 },      // 3F past the main stairs
    libraryBack: { x0: -44, x1: -40, z0: 2, z1: 9, y: 4 },     // 2F by the library's back door
    nurse: { x0: -51, x1: -40, z0: -27, z1: -19, y: 4 },       // 2F the nurse's room
    canteen: { x0: -51, x1: -40, z0: -19, z1: 1, y: 0 },       // 1F the canteen
    adminDoor: { x0: -16, x1: 0, z0: -2, z1: 2, y: 0 },        // 1F the corridor by the PR room and the office
    flagYard: { x0: -34, x1: 30, z0: 10, z1: 44, y: 0 },
    gate: { x0: 24, x1: 34, z0: 50, z1: 59, y: 0 },
  },
  spawns: {
    corridor3: [{ x: 7, y: 8, z: -0.8 }, { x: 9, y: 8, z: 0.8 }, { x: 11, y: 8, z: -0.4 }],
    corridor3Far: [{ x: 17, y: 8, z: -0.8 }, { x: 19, y: 8, z: 0.8 }, { x: 21, y: 8, z: 0 }],
    wing2: [{ x: -42.5, y: 4, z: -12 }, { x: -42.5, y: 4, z: -15 }, { x: -42.5, y: 4, z: -9 }],
    libWindows: [{ x: -36, y: 4, z: 8 }, { x: -28, y: 4, z: 8 }, { x: -32, y: 4, z: 8.2 }],
    libDoors: [{ x: -38.4, y: 4, z: 5.5 }, { x: -27, y: 4, z: 4.2 }, { x: -38.4, y: 4, z: 4.2 }],
    canteenFar: [{ x: -48, y: 0, z: -15 }, { x: -44, y: 0, z: -15 }, { x: -48, y: 0, z: -7 }, { x: -44, y: 0, z: -7 }],
    corridor1: [{ x: -24, y: 0, z: 0 }, { x: -28, y: 0, z: 0.5 }, { x: 4, y: 0, z: -0.5 }],
    yardRows: [{ x: -10, y: 0, z: 30 }, { x: 10, y: 0, z: 30 }, { x: 0, y: 0, z: 36 }, { x: -5, y: 0, z: 24 }],
  },
  // ---------------- the phone (story round 2: js/story/phone.js) ----------------
  //   contacts   who writes; messages: what they write (English, subtitled as a line is);
  //   notices    the phone's notifications (an app's name, an icon, the text)
  contacts: { beam: { name: "story.who.beam" }, min: { name: "story.who.min" } },
  messages: {
    beam1: { from: "beam", text: "story.ch1.m.beam1" },
    beam2: { from: "beam", text: "story.ch1.m.beam2" },
    min1: { from: "min", text: "story.ch1.m.min1" },
  },
  notices: {
    cal: { app: "story.app.calendar", icon: "📅", text: "story.ch1.n.cal" },
    ad: { app: "story.app.lexa", icon: "📣", text: "story.ch1.n.ad" },
  },
  // ---------------- the scenes (titles, objectives, clock: the design's; beats: stand-ins) ----------------
  // (round 2) hud / lens: how a scene starts -- the prologue with no HUD and no glasses (the
  // design: the HUD boots part by part once the glasses are on); every other scene, all of it.
  // (round 4) each where the design has it on the chapter's map, with its time of day
  // (`light`). The prologue's beats still try the narrative tools with the design's own lines,
  // cutting (teleport) from the gate to the entrance hall, room 305 and its corridor (story
  // round 5 builds the real prologue).
  scenes: [
    { id: "prologue", title: "story.ch1.s0", objective: "story.ch1.s0.obj", prologue: true, noDeath: true, start: { x: 29.5, y: 0, z: 55, yaw: 0.5 },
      clock: "07:10", hud: "none", lens: false, light: "morning",
      beats: [
        // 1. the alarm: the phone (at the gate, in the morning)
        { do: [["objective", "story.ch1.s0.obj"], ["notify", "cal"]] },
        { wait: { time: 1.2 }, do: [["notify", "ad"]] },
        { wait: { time: 1.4 }, do: [["phone", "beam1"]] },
        { wait: { time: 1.8 }, do: [["phone", "beam2"]] },
        { wait: { time: 1.4 }, do: [["ask", { id: "beam", who: "beam", line: "story.ch1.m.beam2",
          options: [{ text: "story.ch1.c.what", value: "what" }, { text: "story.ch1.c.promise", value: "promise" }] }]] },
        // 2. on the way: the radio
        { wait: { chosen: "beam" }, do: [["say", [{ who: "radio", line: "story.ch1.d.radio" }]]] },
        // 3. in: the entrance hall -- Beam's lost word (a practice word: not counted), Kru Min on the stairs
        { wait: { zone: "entry" }, do: [["ask", { id: "pencil", who: "beam", line: "story.ch1.d.beamThing", quiz: { word: "pencil", practice: true },
          options: [{ text: "story.ch1.c.pencil", value: "pencil", right: true }, { text: "story.ch1.c.eraser", value: "eraser" }, { text: "story.ch1.c.ruler", value: "ruler" }],
          right: [{ who: "beam", line: "story.ch1.d.beamPencil" }], wrong: [{ who: "beam", line: "story.ch1.d.beamPencilNo" }] }]] },
        { wait: { chosen: "pencil" }, do: [["say", [{ who: "min", line: "story.ch1.d.minLuck" }]]] },
        // 4. the exam room, 305 on 3F: the glasses, the HUD's first part
        { wait: { said: true }, cine: "exam", do: [["teleport", { x: -3.5, y: 8, z: -6.5, yaw: Math.PI / 2 }], ["say", [{ who: "invig", line: "story.ch1.d.invigLens" }]]] },
        { wait: { said: true }, cine: "exam", do: [["lens", true], ["hud", ["word"]], ["sys", "story.ch1.sys.calib"]] },
        { wait: { time: 2.4 }, cine: "exam", do: [["say", [{ who: "invig", line: "story.ch1.d.invigForty" }]]] },
        { wait: { said: true }, cine: "exam", do: [["sys", { key: "story.ch1.sys.anomaly", glitch: true }]] },
        // 5. Beam changes: health and stamina
        { wait: { time: 1.8 }, cine: "exam", do: [["say", [{ who: "beam", line: "story.ch1.d.beamName" }, { who: "beam", line: "story.ch1.d.beamTogether" }, { who: "pa", line: "story.ch1.d.paRemain" }]]] },
        { wait: { said: true }, cine: "exam", do: [["hud", ["word", "vitals"]], ["sys", "story.ch1.sys.vital"]] },
        // 6. the corridor outside 305 and the first gun: the view turned to them, the bars, the world slowed
        { wait: { time: 1.6 }, cine: "corridor", do: [["teleport", { x: -1.5, y: 8, z: 0.4, yaw: -Math.PI / 2 }], ["bars", true], ["look", { at: "corridor3", y: 9.4, sec: 1.4 }], ["say", [{ who: "chai", line: "story.ch1.d.chaiTake" }]]] },
        { wait: { said: true }, cine: "corridor", do: [["hud", "all"], ["sys", "story.ch1.sys.resumed"], ["bars", false], ["spawn", { id: "p1", at: "corridor3", count: 3 }], ["slow", 1.2]] },
        // 7. the group down: Kru Min's message, the chapter begins
        { wait: { cleared: "p1" }, do: [["say", [{ who: "chai", line: "story.ch1.d.chaiGo" }]], ["phone", "min1"], ["prologueDone"], ["checkpoint"], ["next"]] },
      ] },
    { id: "s1", title: "story.ch1.s1", objective: "story.ch1.s1.obj", start: { x: -1.5, y: 8, z: 0.4, yaw: -Math.PI / 2 }, clock: "08:50", light: "alarm",
      beats: [
        { do: [["objective", "story.ch1.s1.obj"]] },
        { wait: { zone: "corridor3East" }, do: [["banner", "story.ph.group"], ["spawn", { id: "c1", at: "corridor3Far", count: 3 }]] },
        { wait: { cleared: "c1" }, do: [["banner", "story.ph.clear"], ["checkpoint"], ["next"]] },
      ] },
    { id: "s2", title: "story.ch1.s2", objective: "story.ch1.s2.obj", start: { x: 25.5, y: 4, z: -0.5, yaw: Math.PI / 2 }, clock: "09:10", light: "blackout",
      beats: [
        { do: [["objective", "story.ch1.s2.obj"]] },
        { wait: { zone: "libraryBack" }, do: [["spawn", { id: "r1", at: "wing2", count: 2 }]] },
        { wait: { cleared: "r1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s3", title: "story.ch1.s3", objective: "story.ch1.s3.obj", start: { x: -31.5, y: 4, z: 4.6, yaw: Math.PI }, clock: "09:30", light: "library",
      beats: [
        { do: [["objective", "story.ch1.s3.obj"], ["spawn", { id: "d1", at: "libWindows", count: 2 }]] },
        { wait: { cleared: "d1" }, do: [["checkpoint", { x: -31.5, y: 4, z: 4.6, yaw: Math.PI }], ["spawn", { id: "d2", at: "libDoors", count: 3 }]] },
        { wait: { cleared: "d2" }, do: [["banner", "story.ph.clear"], ["checkpoint"], ["next"]] },
      ] },
    { id: "s4", title: "story.ch1.s4", objective: "story.ch1.s4.obj", start: { x: -33, y: 4, z: 4.6, yaw: Math.PI / 2 }, clock: "10:15", light: "nurse",
      beats: [
        { do: [["objective", "story.ch1.s4.obj"]] },
        { wait: { zone: "nurse" }, do: [["spawn", { id: "n1", at: "wing2", count: 2 }]] },
        { wait: { cleared: "n1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s5", title: "story.ch1.s5", objective: "story.ch1.s5.obj", start: { x: -42, y: 4, z: -17.5, yaw: Math.PI }, clock: "12:30", light: "noon",
      beats: [
        { do: [["objective", "story.ch1.s5.obj"]] },
        { wait: { zone: "canteen" }, do: [["banner", "story.ph.group"], ["spawn", { id: "f1", at: "canteenFar", count: 4 }]] },
        { wait: { cleared: "f1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s6", title: "story.ch1.s6", objective: "story.ch1.s6.obj", start: { x: -41.2, y: 0, z: -1, yaw: -Math.PI / 2 }, clock: "17:00", light: "golden",
      beats: [
        { do: [["objective", "story.ch1.s6.obj"]] },
        { wait: { zone: "adminDoor" }, do: [["spawn", { id: "h1", at: "corridor1", count: 3 }]] },
        { wait: { cleared: "h1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s7", title: "story.ch1.s7", objective: "story.ch1.s7.obj", start: { x: 4.5, y: 0, z: 6, yaw: Math.PI }, clock: "17:45", light: "sunset",
      beats: [
        { do: [["objective", "story.ch1.s7.obj"]] },
        { wait: { zone: "flagYard" }, do: [["banner", "story.ph.group"], ["spawn", { id: "b1", at: "yardRows", count: 4 }]] },
        { wait: { cleared: "b1" }, do: [["checkpoint"], ["next"]] },
      ] },
    { id: "s8", title: "story.ch1.s8", objective: "story.ch1.s8.obj", start: { x: 0, y: 0, z: 30, yaw: -2.35 }, clock: "18:15", light: "dusk",
      beats: [
        { do: [["objective", "story.ch1.s8.obj"]] },
        { wait: { zone: "gate" }, do: [["end"]] },
      ] },
  ],
};

// chapter 2: named in the lobby only (coming in a later update)
G.STORY_CHAPTERS.ch2 = { id: "ch2", n: 2, title: "story.ch2.title", soon: true, scenes: [] };
