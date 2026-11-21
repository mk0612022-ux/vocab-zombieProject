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
// replace each scene's beats with the design's -- round 5 the prologue
// (its people, things to use, practice exam: js/story/cast.js, interact.js,
// aimquiz.js, screen.js).
//   practice       (round 5) words the prologue uses that the bank does not have, with
//                  their meanings in the four meaning languages: practice, counted nowhere
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

// (story round 5) the prologue's words that are not the Master Word Bank's, with their
// meanings in the four meaning languages: vocabulary data of their own (js/data/story/ch1words.js)
const CH1_PRACTICE = (G.STORY_WORDS && G.STORY_WORDS.ch1) || {};

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
  practice: CH1_PRACTICE,                 // (round 5: the prologue's words the bank does not have -- above)
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
    // (round 5) the prologue's: the foot of the main stairs, Room 305, the corridor outside it
    stairsFoot: { x0: 0, x1: 8.5, z0: -3.8, z1: 1.5, y: 0 },
    r305: { x0: -7, x1: 0, z0: -9, z1: -3.3, y: 8 },
    corr305: { x0: -8, x1: 3, z0: -2.2, z1: 1.8, y: 8 },
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
    // (round 5) the prologue as the design has it, 4 minutes, a tutorial all through: no gun and no
    // HUD until the glasses (then a part at a time), the people of the morning on the map, the
    // practice exam answered by aiming, Beam turning, the jammed door, Sgt. Chai's pistol, CLEAN /
    // CLEAR / LEAN (practice words: counted nowhere), Kru Min's message and the chapter's title
    { id: "prologue", title: "story.ch1.s0", objective: "story.ch1.obj.wake", prologue: true, noDeath: true, armed: false,
      start: { x: 29.5, y: 0, z: 56.5, yaw: 0 }, clock: "07:10", hud: "none", lens: false, light: "morning",
      doors: { DR305: true, DR305F: false },
      props: [
        { id: "car", kind: "policeCar", at: { x: 13, y: 0, z: 16 }, yaw: Math.PI / 2 },
        { id: "lockers", kind: "locker", at: { x: -1.5, y: 8, z: 1.75 }, yaw: Math.PI, o: { n: 2 } },          // (Sgt. Chai leans on them, part 6)
      ],
      cast: [
        { id: "beam", who: "beam", at: { x: 27.8, y: 0, z: 53.6 }, face: "player" },
        { id: "chai", who: "chai", at: { x: 10, y: 0, z: 16.3 }, yaw: -Math.PI / 2, pose: "carry", carry: "examBox" },
        { id: "min", who: "min", at: { x: 2.5, y: 2, z: -8.2 }, yaw: 0, hidden: true },
        { id: "invig", who: "invig", at: { x: -6.1, y: 8, z: -6.4 }, yaw: Math.PI / 2 },
        { id: "c1", who: "c1", at: { x: -3.56, y: 8, z: -8 }, yaw: -Math.PI / 2, pose: "sit" },
        { id: "c2", who: "c2", at: { x: -3.56, y: 8, z: -6.4 }, yaw: -Math.PI / 2, pose: "sit" },
        { id: "c3", who: "c3", at: { x: -3.56, y: 8, z: -4.8 }, yaw: -Math.PI / 2, pose: "slump" },
        { id: "c4", who: "c4", at: { x: -0.36, y: 8, z: -8 }, yaw: -Math.PI / 2, pose: "sit" },
        { id: "c5", who: "c5", at: { x: -0.36, y: 8, z: -6.4 }, yaw: -Math.PI / 2, pose: "sit" },
        { id: "c6", who: "c6", at: { x: -1.96, y: 8, z: -4.8 }, yaw: -Math.PI / 2, pose: "sit" },
        { id: "chai2", who: "chai", at: { x: -1.5, y: 8, z: 1.25 }, yaw: Math.PI, pose: "floor", hidden: true },
      ],
      beats: [
        // ---- 1. the alarm (0:00-0:20): a black screen, the phone -- tap a notification, a word, an answer
        { do: [["black", { on: true, sec: 0 }], ["sound", "alarm"], ["notify", "cal"]] },
        { wait: { time: 1.4 }, do: [["hint", { key: "story.hint.phone", bind: "phone" }], ["notify", "ad"]] },
        { wait: { time: 1.2 }, do: [["phone", "beam1"]] },
        { wait: { time: 1.2 }, do: [["phone", "beam2"]] },
        { wait: { read: "beam" }, do: [["hint", null]] },
        { wait: { time: 1.0 }, do: [["ask", { id: "beam", who: "beam", line: "story.ch1.m.beam2",
          options: [{ text: "story.ch1.c.what", value: "what" }, { text: "story.ch1.c.promise", value: "promise" }] }]] },
        // ---- 2. the school gate (0:20-0:40): walked in, free to look round; the radio; Sgt. Chai's box
        { wait: { chosen: "beam" }, do: [["black", { on: false, sec: 1.8 }], ["sound", "stop"], ["objective", "story.ch1.s0.obj"], ["hint", "story.hint.look"]] },
        { wait: { time: 1.5 }, cine: "gate", do: [["npc", { id: "beam", follow: true }], ["walk", { x: 27, z: 46, speed: 0.85 }], ["sound", "static"],
          ["say", [{ who: "radio", line: "story.ch1.d.radio" }]],
          ["npc", { id: "chai", walk: [{ x: 7.5, z: 13.5 }, { x: 4.6, z: 11 }, { x: 4.6, z: 7.2 }, { x: 3.6, z: -0.8 }, { x: 2.6, z: -3.6 }], speed: 1.25, then: "hide" }]] },
        { wait: { walked: true }, cine: "gate", do: [["walk", { x: 17, z: 30, speed: 0.85 }]] },
        { wait: { walked: true }, cine: "gate", do: [["walk", { x: 7, z: 14, speed: 0.85 }]] },
        { wait: { walked: true }, cine: "gate", do: [["walk", { x: 4.6, z: 9.8, speed: 0.7 }]] },
        // ---- 3. into the building (0:40-1:25): walking by themselves, the seating plan, Beam's lost word, Kru Min
        { wait: { walked: true }, do: [["hint", "story.hint.walk"], ["objective", "story.ch1.obj.board"],
          ["use", { id: "board", at: { x: 3.2, y: 0, z: 4.8 }, size: [1.7, 1.4, 0.5], lift: 1.1, prompt: "story.use.board", sound: "paper" }]] },
        { wait: { used: "board" }, do: [["hint", null], ["card", { id: "plan", title: "story.card.title", mark: 5, note: "story.card.note",
          rows: [["story.card.seat", "story.card.cand"], ["A1", "Anan K."], ["A2", "Busaba P."], ["A3", "Chanon T."], ["B1", "Beam W."], ["B2", "{name}"],
            ["B3", "Duangjai S."], ["C1", "Kanya R."], ["C2", "Pakorn M."], ["C3", "Wipada N."]] }]] },
        { wait: { card: "plan" }, do: [["npc", { id: "beam", face: "player", talk: 2.4 }],
          ["ask", { id: "pencil", who: "beam", line: "story.ch1.d.beamThing", quiz: { word: "pencil", practice: true },
            options: [{ text: "story.ch1.c.pencil", value: "pencil", right: true }, { text: "story.ch1.c.eraser", value: "eraser" }, { text: "story.ch1.c.ruler", value: "ruler" }],
            right: [{ who: "beam", line: "story.ch1.d.beamPencil" }], wrong: [{ who: "beam", line: "story.ch1.d.beamPencilNo" }] }]] },
        { wait: { chosen: "pencil" }, do: [["objective", "story.ch1.obj.go305"]] },
        { wait: { zone: "stairsFoot" }, cine: "min", do: [["npc", { id: "min", show: true, walk: [{ x: 2.5, z: -6.8 }, { x: 2.5, z: -3.7 }, { x: 3.1, z: -1.5 }], speed: 1.3 }]] },
        { wait: { arrived: "min" }, cine: "min", do: [["npc", { id: "min", face: "player", talk: 3.5 }], ["say", [{ who: "min", line: "story.ch1.d.minLuck" }]],
          ["npc", { id: "beam", face: { x: 9, z: 3 } }]] },
        { wait: { said: true }, cine: "min", do: [["npc", { id: "min", walk: [{ x: -3, z: -0.6 }, { x: -12, z: -0.6 }], speed: 1.3, then: "remove" }], ["npc", { id: "beam", follow: true }]] },
        // ---- 4. Room 305 (1:25-2:25): a seat, the glasses -- the question box -- three practice questions
        { wait: { zone: "r305" }, do: [["objective", "story.ch1.obj.seat"], ["use", { id: "seat", at: { x: -1.96, y: 8, z: -6.4 }, size: [0.7, 1.0, 0.7], lift: 0.5, prompt: "story.use.sit" }],
          ["npc", { id: "beam", walk: [{ x: -1.25, z: -7.2 }, { x: -1.96, z: -8 }], speed: 1.4, then: { pose: "scratch", face: -Math.PI / 2 } }]] },
        { wait: { used: "seat" }, do: [["seat", { x: -1.96, z: -6.4, yaw: Math.PI / 2 }], ["door", { id: "DR305", open: false }],
          ["prop", { id: "lens", kind: "lexiLens", at: { x: -2.55, y: 8.745, z: -6.35 }, yaw: Math.PI / 2 }],
          ["npc", { id: "invig", talk: 4.5 }], ["say", [{ who: "invig", line: "story.ch1.d.invigLens" }]]] },
        { wait: { said: true }, do: [["objective", "story.ch1.obj.lens"],
          ["use", { id: "lens", at: { x: -2.5, y: 8, z: -6.4 }, size: [0.55, 0.3, 0.55], lift: 0.85, prompt: "story.use.lens", sound: "pickup" }]] },
        { wait: { used: "lens" }, do: [["unprop", "lens"], ["lens", true], ["hud", ["word"]], ["sys", "story.ch1.sys.calib"], ["objective", "story.ch1.obj.exam"]] },
        { wait: { time: 2.8 }, do: [["hint", "story.hint.aim"], ["quiz", { id: "exam", items: [
          { word: "scholarship", options: ["scholarship", "scholar", "schedule"], answer: 0, glosses: { scholar: CH1_PRACTICE.scholar, schedule: CH1_PRACTICE.schedule } },
          { word: "invigilator", gloss: CH1_PRACTICE.invigilator, options: ["invigilator", "investigator", "instructor"], answer: 0,
            glosses: { investigator: CH1_PRACTICE.investigator, instructor: CH1_PRACTICE.instructor } },
          { word: "candidate", cloze: "story.ch1.q3", gloss: CH1_PRACTICE.candidate, options: ["candidate", "candle", "candid"], answer: 0,
            glosses: { candle: CH1_PRACTICE.candle, candid: CH1_PRACTICE.candid } },
        ] }]] },
        { wait: { quiz: "exam" }, cine: "spike", do: [["hint", null], ["npc", { id: "invig", talk: 5 }],
          ["say", [{ who: "invig", line: "story.ch1.d.invigForty" }, { who: "invig", line: "story.ch1.d.invigLoop" }]]] },
        { wait: { said: true }, cine: "spike", do: [["sys", { key: "story.ch1.sys.anomaly", glitch: true }], ["light", "alarm"], ["sound", "bell"], ["glitch", 1.8]] },
        // ---- 5. Beam changes (2:25-3:05): health and stamina; a push in time; the jammed door; run
        { wait: { time: 1.2 }, cine: "spike", do: [["npc", { id: "beam", pose: "stand", turn: "beam_z", label: { word: "TOGETHER", flicker: true }, face: "player", talk: 4 }],
          ["sys", { key: "story.ch1.sys.warn", glitch: true }],
          ["say", [{ who: "beam", line: "story.ch1.d.beamName" }, { who: "beam", line: "story.ch1.d.beamTogether" }]]] },
        { wait: { said: true }, cine: "spike", do: [["npc", { id: "c1", turn: true, pose: "zombie", face: "player" }], ["npc", { id: "c2", turn: true, pose: "zombie", face: "player" }],
          ["npc", { id: "c3", turn: true, pose: "zombie", face: "player" }], ["npc", { id: "c4", turn: true, pose: "zombie", face: "player" }],
          ["npc", { id: "c5", turn: true, pose: "zombie", face: "player" }], ["npc", { id: "c6", turn: true, pose: "zombie", face: "player" }],
          ["npc", { id: "invig", turn: "invig_z", pose: "zombie", face: "player" }],
          ["say", [{ who: "pa", line: "story.ch1.d.paRemain" }]], ["hud", ["word", "vitals"]], ["sys", { key: "story.ch1.sys.vital", now: true }], ["seat", false]] },
        { wait: { said: true }, do: [["objective", "story.ch1.obj.out"], ["npc", { id: "beam", pose: "zombie", lunge: true }]] },
        { wait: { near: { id: "beam", r: 1.3 } }, do: [["qte", { id: "push", prompt: "story.qte.push" }]] },
        { wait: { qte: "push" }, do: [["npc", { id: "beam", knock: 1.8 }], ["shake", { sec: 0.25, amp: 0.04 }], ["objective", "story.ch1.obj.kick"], ["hint", { key: "story.hint.stuck", bind: "interact" }],
          ["use", { id: "kick", at: { x: -1.5, y: 8, z: -2.6 }, size: [1.0, 2.0, 0.6], lift: 1.0, prompt: "story.use.door" }]] },
        { wait: { used: "kick" }, do: [["sound", "kick"], ["shake", { sec: 0.35, amp: 0.06 }], ["door", { id: "DR305", open: true }], ["objective", "story.ch1.obj.run"],
          ["hint", { key: "story.hint.run", bind: "sprint" }], ["npc", { id: "chai2", show: true }],
          ["prop", { id: "pp1", kind: "papers", at: { x: -3.2, y: 8, z: 0.2 } }], ["prop", { id: "pp2", kind: "papers", at: { x: 0.4, y: 8, z: -0.9 }, yaw: 1.2 }],
          ["prop", { id: "pp3", kind: "papers", at: { x: 1.8, y: 8, z: 0.8 }, yaw: 2.1 }], ["prop", { id: "box", kind: "examBox", at: { x: -0.2, y: 8, z: 1.35 }, yaw: 0.4, collider: false }]] },
        // ---- 6. the corridor and the first gun (3:05-3:45): aim, shoot the words, the card on a wrong one, reload
        { wait: { zone: "corr305" }, cine: "chai", do: [["hint", null], ["bars", true], ["look", { x: -1.5, y: 8.7, z: 1.4, sec: 0.8 }], ["npc", { id: "chai2", talk: 3 }],
          ["say", [{ who: "chai", line: "story.ch1.d.chaiTake" }]]] },
        { wait: { said: true }, cine: "chai", do: [["arm", true], ["hud", "all"], ["sys", { key: "story.ch1.sys.resumed", meaningOf: "clean", now: true }], ["bars", false],
          ["spawn", { id: "p1", at: "corridor3", kinds: ["normal", "normal", "normal"], target: "clean",
            words: [{ word: "clean", gloss: CH1_PRACTICE.clean, who: "porn" }, { word: "clear", gloss: CH1_PRACTICE.clear }, { word: "lean", gloss: CH1_PRACTICE.lean }] }],
          ["slow", 1.2], ["hint", "story.hint.shoot"]] },
        { wait: { cleared: "p1" }, do: [["unflag", "reloaded"], ["objective", "story.ch1.obj.reload"], ["hint", { key: "story.hint.reload", bind: "reload" }]] },
        { wait: { reloaded: true }, do: [["hint", null], ["npc", { id: "chai2", talk: 1.6, label: { word: "PROTECT", flicker: true } }], ["say", [{ who: "chai", line: "story.ch1.d.chaiGo" }]]] },
        // ---- 7. Kru Min's message (3:45-4:00): read it; the chapter's title; its first objective
        { wait: { said: true }, do: [["phone", "min1"], ["hint", { key: "story.hint.readMin", bind: "phone" }]] },
        { wait: { read: "min" }, do: [["hint", null], ["title", { key: "story.title.brand", sub: "story.title.ch1" }], ["objective", "story.ch1.obj.library"]] },
        { wait: { time: 4.6 }, do: [["prologueDone"], ["checkpoint"], ["next"]] },
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
