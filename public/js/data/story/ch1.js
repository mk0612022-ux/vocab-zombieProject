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
// aimquiz.js, screen.js); round 6 scenes 1-1 and 1-2 (a scene's rules `on`, doors
// opened by hand, the letter lock: js/story/wheellock.js, the whispers: whisper.js); round 7 scenes
// 1-3 and 1-4 (bookshelves pushed: js/story/push.js, the medicine cabinet: pick.js, the defence's
// waves, Crawlers under the tables, Nam's dictionary, Nurse Pim); round 8 scene 1-5 (the canteen's
// two waves, boxes taken by holding the button, Coach Ek: js/story/miniboss.js, the shotgun); round 9
// scene 1-6 (Kru Min to the PR room: js/story/escort.js; the announcement, its loop, the hold: pa.js).
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
    // (round 6) 1-1 on 3F: in front of the main stairs' glass, the corridor past it in two parts, rooms
    // 302 and 307, the east door; the foot of the east stairs on 2F (the save point)
    mainStairs3: { x0: 1, x1: 8, z0: -2, z1: 1.9, y: 8 },
    c3mid: { x0: 8.5, x1: 13, z0: -2, z1: 2, y: 8 },
    c3east: { x0: 13, x1: 24, z0: -2, z1: 2, y: 8 },
    r302: { x0: -31, x1: -24, z0: -9, z1: -3, y: 8 },
    r307: { x0: -15, x1: -8, z0: 3, z1: 9, y: 8 },
    eastDoor3: { x0: 21, x1: 24.2, z0: -2, z1: 2, y: 8 },
    eastStairs2: { x0: 24.6, x1: 27.2, z0: -3, z1: 2, y: 4 },
    // 1-2 on 2F: just inside the library's back door
    libraryIn: { x0: -39, x1: -34, z0: 3, z1: 9, y: 4 },
    // (round 7) 1-4: the west wing's corridor past its first door (the desks knocked over, Crawlers
    // under them); the nurse's room is `nurse`
    wingIn: { x0: -44, x1: -40, z0: -13, z1: -3.5, y: 4 },
    // ...and back in the library, past the shelf's way (the back door shut and its shelf pushed back behind them)
    libraryDeep: { x0: -37.6, x1: -24, z0: 3, z1: 9, y: 4 },
    // (round 8) 1-5: the foot of the back stairs (1F), the kitchen, the walkway to the gym (the save), just
    // inside the gym, its north end by the car park's door
    backStairs1: { x0: -46.6, x1: -44.4, z0: 2, z1: 9, y: 0 },
    kitchenIn: { x0: -51, x1: -40.2, z0: -27, z1: -20, y: 0 },
    walkway: { x0: -39.2, x1: -37, z0: -27.4, z1: -21.6, y: 0 },
    gymIn: { x0: -35.6, x1: -27, z0: -31, z1: -22.2, y: 0 },
    gymNorth: { x0: -36, x1: -10, z0: -46, z1: -40, y: 0 },
    // (round 9) 1-6: the lobby at the foot of the back stairs and the corridor's west end; half way along it; near
    // the PR room; just inside it, the office next to it, the two together with the corridor by them
    lobby1: { x0: -44.4, x1: -36, z0: -2.2, z1: 9, y: 0 },
    corr1Half: { x0: -27, x1: -19, z0: -2.2, z1: 2.2, y: 0 },
    nearPR: { x0: -17, x1: -8, z0: -2.2, z1: 2.4, y: 0 },
    prIn: { x0: -15, x1: -8, z0: 3.2, z1: 9, y: 0 },
    adminIn: { x0: -7.4, x1: 0, z0: 3, z1: 9, y: 0 },
    office: { x0: -17, x1: 2, z0: -2.2, z1: 9, y: 0 },
    parkIn: { x0: -44, x1: -4, z0: -66, z1: -48, y: 0 },
  },
  spawns: {
    // (round 6) out of the 3F toilets; hiding in the 2F store room
    wc3: [{ x: 12.5, y: 8, z: 6.8 }, { x: 11, y: 8, z: 7.8 }],
    store2In: [{ x: 14.4, y: 4, z: -6.6 }],
    corridor3: [{ x: 7, y: 8, z: -0.8 }, { x: 9, y: 8, z: 0.8 }, { x: 11, y: 8, z: -0.4 }],
    corridor3Far: [{ x: 17, y: 8, z: -0.8 }, { x: 19, y: 8, z: 0.8 }, { x: 21, y: 8, z: 0 }],
    wing2: [{ x: -42.5, y: 4, z: -12 }, { x: -42.5, y: 4, z: -15 }, { x: -42.5, y: 4, z: -9 }],
    libWindows: [{ x: -36, y: 4, z: 8 }, { x: -28, y: 4, z: 8 }, { x: -32, y: 4, z: 8.2 }],
    libDoors: [{ x: -38.4, y: 4, z: 5.5 }, { x: -27, y: 4, z: 4.2 }, { x: -38.4, y: 4, z: 4.2 }],
    // (round 7) 1-3: under the library's air vents (Crawlers let themselves down); just inside each
    // door (a shelf not back in place: they come through); the north-west window (broken on Tonkla)
    libVents: [{ x: -35.5, y: 4, z: 8.4 }, { x: -27.5, y: 4, z: 8.4 }, { x: -31.5, y: 4, z: 8.5 }],
    libFrontIn: [{ x: -25.6, y: 4, z: 3.95 }, { x: -26.4, y: 4, z: 4.3 }],
    libBackIn: [{ x: -38.2, y: 4, z: 5.4 }, { x: -37.8, y: 4, z: 4.6 }],
    libNW: [{ x: -36.9, y: 4, z: 8.4 }, { x: -36.2, y: 4, z: 8.5 }],
    // 1-4: under the desks knocked over in the west wing; the 2F corridor towards the main stairs
    wingDesks: [{ x: -41.2, y: 4, z: -6.6 }, { x: -43.1, y: 4, z: -10.5 }, { x: -41.5, y: 4, z: -14.5 }],
    corridor2East: [{ x: -21, y: 4, z: -0.6 }, { x: -19, y: 4, z: 0.4 }, { x: -23, y: 4, z: 0.2 }, { x: -17, y: 4, z: -0.3 }],
    canteenFar: [{ x: -48, y: 0, z: -15 }, { x: -44, y: 0, z: -15 }, { x: -48, y: 0, z: -7 }, { x: -44, y: 0, z: -7 }],
    // (round 8) 1-5: in the kitchen; at the foot of the back stairs (the way the player came); the gym's
    // locker room (Sprinters in PE kit); the gym's floor (the way back, the shotgun in hand)
    kitchenFar: [{ x: -48, y: 0, z: -23.6 }, { x: -46, y: 0, z: -24.6 }, { x: -43.6, y: 0, z: -23.2 }],
    backStairsFoot: [{ x: -45.5, y: 0, z: 3.2 }, { x: -45.5, y: 0, z: 6.2 }, { x: -45.5, y: 0, z: 8.0 }, { x: -45.5, y: 0, z: 4.8 }],
    lockerRoom: [{ x: -16.8, y: 0, z: -25 }, { x: -15.2, y: 0, z: -23.8 }, { x: -15.2, y: 0, z: -26.4 }, { x: -13.4, y: 0, z: -25 }, { x: -13.2, y: 0, z: -27 }, { x: -16.6, y: 0, z: -27.2 }],
    gymFloor: [{ x: -24, y: 0, z: -36 }, { x: -20.5, y: 0, z: -38 }, { x: -27.5, y: 0, z: -38 }, { x: -18.5, y: 0, z: -34 }, { x: -27.6, y: 0, z: -31.4 }],
    corridor1: [{ x: -24, y: 0, z: 0 }, { x: -28, y: 0, z: 0.5 }, { x: 4, y: 0, z: -0.5 }],
    // (round 9) 1-6: the 1F corridor -- its middle, its west half, the entrance's side; inside the PR room's and
    // the admin office's windows
    corr1Mid: [{ x: -20, y: 0, z: -0.6 }, { x: -18.5, y: 0, z: 0.6 }, { x: -22, y: 0, z: 0.1 }],
    corr1West: [{ x: -29, y: 0, z: 0.5 }, { x: -31, y: 0, z: -0.6 }, { x: -33, y: 0, z: 0.2 }, { x: -27.4, y: 0, z: -0.4 }],
    corr1East: [{ x: 4, y: 0, z: -0.5 }, { x: 6, y: 0, z: 0.6 }, { x: 8, y: 0, z: 0 }, { x: 2.6, y: 0, z: 0.5 }],
    prWindow: [{ x: -13.0, y: 0, z: 8.3 }, { x: -10.2, y: 0, z: 8.3 }, { x: -12.0, y: 0, z: 8.4 }],
    adminWindow: [{ x: -2.0, y: 0, z: 8.3 }, { x: -5.0, y: 0, z: 8.3 }, { x: -3.2, y: 0, z: 8.4 }],
    yardRows: [{ x: -10, y: 0, z: 30 }, { x: 10, y: 0, z: 30 }, { x: 0, y: 0, z: 36 }, { x: -5, y: 0, z: 24 }],
  },
  // ---------------- the phone (story round 2: js/story/phone.js) ----------------
  //   contacts   who writes; messages: what they write (English, subtitled as a line is);
  //   notices    the phone's notifications (an app's name, an icon, the text)
  contacts: { beam: { name: "story.who.beam" }, min: { name: "story.who.min" }, fai: { name: "story.who.fai" }, unknown: { name: "story.who.unknown" }, unknown2: { name: "story.who.unknown2" } },
  messages: {
    beam1: { from: "beam", text: "story.ch1.m.beam1" },
    beam2: { from: "beam", text: "story.ch1.m.beam2" },
    min1: { from: "min", text: "story.ch1.m.min1" },
    // (round 6) 1-1: are you OK, and her answer to the reply; 1-2: the directions, the back door's clue, the hint
    min2: { from: "min", text: "story.ch1.m.min2" }, min3a: { from: "min", text: "story.ch1.m.min3a" }, min3b: { from: "min", text: "story.ch1.m.min3b" },
    min4: { from: "min", text: "story.ch1.m.min4" }, min5: { from: "min", text: "story.ch1.m.min5" }, min6: { from: "min", text: "story.ch1.m.min6" },
    // (round 7) 1-4: the list for the nurse's room
    min7: { from: "min", text: "story.ch1.m.min7" },
    // (round 8) 1-5: the water; Sgt. Chai's car
    min8: { from: "min", text: "story.ch1.m.min8" }, min9: { from: "min", text: "story.ch1.m.min9" },
    // (round 9) 1-6: who heard the announcement
    fai1: { from: "fai", text: "story.ch1.m.fai1" }, unk1: { from: "unknown", text: "story.ch1.m.unk1" }, unk2: { from: "unknown2", text: "story.ch1.m.unk2" },
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
        { wait: { time: 1.4 }, do: [["hint", { key: "story.hint.phone", bind: "phone" }], ["notify", "ad"], ["sound", "jingle"]] },        // (round 9: the advertisement's tune -- it comes back broken in 1-6)
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
          ["say", [{ who: "chai", line: "story.ch1.d.chaiTake" }]],
          // (round 6) the room's door slams behind the player as they turn to Sgt. Chai: what is in 305 stays there
          ["door", { id: "DR305", open: false }], ["sound", "slam"]] },
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
    // (round 6) 1-1 The Long Corridor, as the design has it (5-6 minutes): the evacuation plan (the
    // objective once it is read), the crowd behind the main stairs' glass, Kru Min's text, Shamblers
    // in twos and threes, rooms 302 and 307 to look into, the janitor's crowbar and his photos, the
    // east stairwell's jammed door pried open. What can happen in any order is the scene's rules (`on`).
    { id: "s1", title: "story.ch1.s1", objective: "story.ch1.s1.obj0", start: { x: -1.5, y: 8, z: 0.4, yaw: -Math.PI / 2 }, clock: "08:50", light: "alarm",
      // 3F: the stairs shut (the main stairs' glass, the jammed east door, the back stairs), 302 and 307
      // open to look into, the janitor's room and the toilets open; the other rooms shut
      doors: { STAIRM3: false, STAIRE3: false, STAIRB3: false, DR305: false, DR305F: false, DR301: false, DR302: true, DR303: false, DR304: false,
        DR306: false, DR307: true, DR308: false, DR309: false, DR310: false, DJANITOR: true, DSTORE3: false, DWC3: true, DSTORE3S: false,
        DR311: false, DR312: false, DWC3W: false, DR313: false },
      props: [
        // (the prologue's corridor, as it was left: the lockers Sgt. Chai leans on, the exam papers)
        { id: "lockers", kind: "locker", at: { x: -1.5, y: 8, z: 1.75 }, yaw: Math.PI, o: { n: 2 } },
        { id: "pp1", kind: "papers", at: { x: -3.2, y: 8, z: 0.2 } }, { id: "pp2", kind: "papers", at: { x: 0.4, y: 8, z: -0.9 }, yaw: 1.2 },
        { id: "pp3", kind: "papers", at: { x: 1.8, y: 8, z: 0.8 }, yaw: 2.1 }, { id: "box", kind: "examBox", at: { x: -0.2, y: 8, z: 1.35 }, yaw: 0.4, collider: false },
        // (bags and answer sheets abandoned all down the corridor -- "abandon", the sys line's)
        { id: "bag1", kind: "schoolBag", at: { x: -6.5, y: 8, z: 1.2 }, yaw: 0.6, collider: false }, { id: "bag2", kind: "schoolBag", at: { x: 7.4, y: 8, z: -1.4 }, yaw: 2.2, collider: false },
        { id: "bag3", kind: "schoolBag", at: { x: 11.8, y: 8, z: 1.3 }, yaw: -0.8, collider: false }, { id: "bag4", kind: "schoolBag", at: { x: 18.6, y: 8, z: -1.2 }, yaw: 1.4, collider: false },
        { id: "bag5", kind: "schoolBag", at: { x: -16.5, y: 8, z: -1.1 }, yaw: 0.3, collider: false },
        { id: "pp4", kind: "papers", at: { x: 5.6, y: 8, z: 0.6 }, yaw: 0.7 }, { id: "pp5", kind: "papers", at: { x: 14.2, y: 8, z: -0.4 }, yaw: 2.6 }, { id: "pp6", kind: "papers", at: { x: 20.5, y: 8, z: 0.9 } },
        // the janitor's crowbar, on two nails under his photos (the first thing the eye goes to in his room)
        { id: "crowbar", melee: "crowbar", at: { x: 15.8, y: 8, z: -6.3 }, lift: 0.95, rx: Math.PI / 2, scale: 1.45 },
      ],
      cast: [
        { id: "chai", who: "chai", at: { x: -1.5, y: 8, z: 1.25 }, yaw: Math.PI, pose: "floor", label: { word: "PROTECT", flicker: true, depth: true } },
        // the crowd packed behind the main stairs' glass doors (Kru Min's "do NOT use the main stairs")
        { id: "gl1", who: "zm1", at: { x: 3.4, y: 8, z: -3.4 }, yaw: 0, pose: "bang" }, { id: "gl2", who: "zf2", at: { x: 4.5, y: 8, z: -3.3 }, yaw: 0, pose: "bang" },
        { id: "gl3", who: "zm3", at: { x: 5.6, y: 8, z: -3.4 }, yaw: 0, pose: "bang" }, { id: "gl4", who: "zf4", at: { x: 6.5, y: 8, z: -4.5 }, yaw: -0.3, pose: "bang" },
        { id: "gl5", who: "zm2", at: { x: 6.4, y: 8, z: -5.5 }, yaw: 0.2, pose: "bang" },
      ],
      beats: [
        { do: [["objective", "story.ch1.s1.obj0"], ["sound", "bell"], ["ammo", { pistol: [12, 12] }], ["sys", "story.ch1.sys.abandon"], ["hint", { key: "story.hint.evac", bind: "interact" }],
          ["use", { id: "evac", at: { x: -5.5, y: 8, z: -1.85 }, size: [1.1, 1.0, 0.45], lift: 1.6, prompt: "story.use.evac", sound: "paper" }],
          ["use", { id: "lockers", at: { x: 16, y: 8, z: 1.55 }, size: [1.6, 1.8, 0.5], lift: 0.95, prompt: "story.use.lockers", sound: "rattle" }],
          ["use", { id: "beamLocker", at: { x: -12, y: 8, z: 1.55 }, size: [1.6, 1.8, 0.5], lift: 0.95, prompt: "story.use.beamLocker", sound: "paper" }],
          ["use", { id: "notice", at: { x: 15.75, y: 8, z: 6 }, size: [0.45, 1.0, 1.7], lift: 1.55, prompt: "story.use.notice", sound: "paper" }],
          ["use", { id: "photo", at: { x: 15.75, y: 8, z: -6 }, size: [0.45, 0.7, 1.3], lift: 1.6, prompt: "story.use.photo", sound: "paper" }],
          ["use", { id: "crowbar", at: { x: 15.75, y: 8, z: -5.8 }, size: [0.5, 0.45, 1.4], lift: 0.95, prompt: "story.use.crowbar", sound: "" }],
          ["use", { id: "pry", at: { x: 24.25, y: 8, z: 0 }, size: [0.7, 2.1, 2.0], lift: 1.05, prompt: "story.use.pry", promptNo: "story.use.jammed", deny: "story.hint.jammed",
            need: { melee: "crowbar" }, sound: "" }]] },
        { wait: { used: "pry" }, do: [["door", { id: "STAIRE3" }], ["sound", "pry"], ["shake", { sec: 0.3, amp: 0.04 }], ["hint", null], ["objective", "story.ch1.s1.obj2"]] },
        // (the save point: at the foot of the east stairs, on 2F -- scene 1-2's start)
        { wait: { all: [{ zone: "eastStairs2" }, { any: [{ calm: true }, { time: 20 }] }] }, do: [["checkpoint"], ["next"]] },
      ],
      on: [
        // the plan read: the way out, then the objective
        { id: "evac", when: { used: "evac" }, do: [["hint", null], ["card", { id: "evac", icon: "🗺️", title: "story.card.evacTitle",
          plan: { storey: 2, here: { x: -5.5, z: -1.3 }, route: [[-5.5, 0], [23.6, 0], [26.4, 0]], exit: "E" }, lines: ["story.ch1.evac.line"] }]] },
        { id: "evacRead", when: { card: "evac" }, do: [["objective", "story.ch1.s1.obj"]] },
        // past the main stairs: the crowd behind the glass; Kru Min writes; the player answers
        { id: "glass", when: { zone: "mainStairs3" }, do: [["look", { x: 4.5, y: 9.4, z: -3.6, sec: 0.7 }], ["sound", "sting"], ["sys", { key: "story.ch1.sys.crowd", glitch: true }]] },
        { id: "min", after: "on:glass", when: { time: 2.2 }, do: [["unflag", "read:min"], ["phone", "min2"], ["hint", { key: "story.hint.readMin", bind: "phone" }]] },
        { id: "minAsk", after: "on:min", when: { read: "min" }, do: [["hint", null], ["ask", { id: "min", who: "min", line: "story.ch1.m.min2",
          options: [{ text: "story.ch1.c.onWay", value: "onway" }, { text: "story.ch1.c.turned", value: "turned" }] }]] },
        { id: "minA", when: { flag: "chose:min:onway" }, do: [["phone", "min3a"]] },
        { id: "minB", when: { flag: "chose:min:turned" }, do: [["phone", "min3b"]] },
        // the Shamblers, in twos and threes: down the corridor from the east; out of the toilets behind;
        // and once the crowbar is in the hands, three more to try it on
        { id: "g1", when: { zone: "c3mid" }, do: [["spawn", { id: "g1", at: "corridor3Far", count: 3, kinds: ["normal"] }]] },
        { id: "g2", after: "on:g1", when: { all: [{ cleared: "g1" }, { zone: "c3east" }] }, do: [["spawn", { id: "g2", at: "wc3", count: 2, kinds: ["normal"] }]] },
        { id: "g3", after: "on:crowbar", when: { time: 2.5 }, do: [["spawn", { id: "g3", at: "corridor3Far", count: 3, kinds: ["normal"] }]] },
        // rooms 302 and 307: a Shambler behind the desk, a box of rounds
        { id: "r302", when: { zone: "r302" }, do: [["spawn", { id: "h302", at: { x: -29.4, y: 8, z: -6.4 }, count: 1, kinds: ["normal"] }], ["drop", { kind: "ammo", at: { x: -27, y: 8, z: -7.6 } }]] },
        { id: "r307", when: { zone: "r307" }, do: [["spawn", { id: "h307", at: { x: -13.9, y: 8, z: 5.6 }, count: 1, kinds: ["normal"] }], ["drop", { kind: "ammo", at: { x: -10.2, y: 8, z: 7.4 } }]] },
        // the janitor's room: the crowbar (the melee slot's), his photos with the students
        { id: "crowbar", when: { used: "crowbar" }, do: [["unprop", "crowbar"], ["give", { melee: "crowbar" }], ["hint", { key: "story.hint.melee", bind: "quickMelee" }]] },
        { id: "photo", when: { used: "photo" }, do: [["card", { id: "photo", icon: "🖼️", title: "story.card.photoTitle", lines: ["story.ch1.photo"] }]] },
        // the lockers: two magazines; Beam's, his note; the toilets' notice ("symptoms", "consequences")
        { id: "lockers", when: { used: "lockers" }, do: [["give", { ammo: { pistol: 24 } }]] },
        { id: "note", when: { used: "beamLocker" }, do: [["card", { id: "note", icon: "📝", title: "story.card.noteTitle", lines: ["story.ch1.note.beam"] }]] },
        { id: "notice", when: { used: "notice" }, do: [["card", { id: "notice", icon: "📄", title: "story.card.noticeTitle", lines: ["story.ch1.notice"] }]] },
        // at the east door without the crowbar: the design's hint
        { id: "jam", when: { all: [{ zone: "eastDoor3" }, { not: { melee: "crowbar" } }] }, do: [["hint", "story.hint.jammed"]] },
      ] },
    // (round 6) 1-2 Words Are the Map (5-7 minutes): 2F dark (the torch), no room signs, Kru Min's
    // directions; the rooms known by what is in them -- opened by hand, a Shambler in the store room;
    // a hint after a minute; the library's front door barricaded, its back door a nine-letter lock
    // (TEMPORARY), Sprinters in PE kit coming while it is turned, Nam's clue through the door.
    { id: "s2", title: "story.ch1.s2", objective: "story.ch1.s2.obj", start: { x: 25.5, y: 4, z: -0.5, yaw: Math.PI / 2 }, clock: "09:10", light: "blackout",
      doors: { STAIRE2: true, STAIRM2: false, STAIRB2: false, DMUSIC: false, DSTAFF: false, DR201: false, DR203: false, DR205: false, DSTORE2: false, DSCIENCE: false,
        DR202: false, DR204: false, DR206: false, DR207: false, DLAB: false, DLIBRARY: false, LIBBACK: false, DPE: false, DSTOREW: false, DWC2: false, DNURSE: false },
      // (round 7) inside the library: the shelf against the front door (its barricade), the one by the
      // back door -- the two that 1-3 pushes (the map's own wall shelves stop short of them)
      props: [
        { id: "frontShelf", kind: "bookshelf", o: { w: 1 }, at: { x: -25.5, y: 4, z: 3.25 }, yaw: 0 },
        { id: "backShelf", kind: "bookshelf", o: { w: 1 }, at: { x: -38.75, y: 4, z: 7.5 }, yaw: Math.PI / 2 },
      ],
      cast: [
        // the main stairs on this floor too: the crowd behind the glass
        { id: "gl1", who: "zf1", at: { x: 3.4, y: 4, z: -3.4 }, yaw: 0, pose: "bang" }, { id: "gl2", who: "zm4", at: { x: 4.5, y: 4, z: -3.3 }, yaw: 0, pose: "bang" },
        { id: "gl3", who: "zf3", at: { x: 5.6, y: 4, z: -3.4 }, yaw: 0, pose: "bang" }, { id: "gl4", who: "zm1", at: { x: 2.4, y: 4, z: -4.6 }, yaw: 0.3, pose: "bang" },
        // in the library, by its back door: Kru Min and the two students (scene 1-3's people)
        // (hidden while the door is shut: nobody sees them, and they cost no draw calls till then)
        { id: "min", who: "min", at: { x: -37, y: 4, z: 5.5 }, yaw: -Math.PI / 2, hidden: true }, { id: "nam", who: "nam", at: { x: -36.6, y: 4, z: 4.3 }, yaw: -Math.PI / 2 + 0.3, hidden: true },
        { id: "tonkla", who: "tonkla", at: { x: -37.4, y: 4, z: 6.9 }, yaw: -Math.PI / 2 - 0.3, hidden: true },
      ],
      beats: [
        { do: [["objective", "story.ch1.s2.obj"], ["sound", "stop"], ["sys", { key: "story.ch1.sys.power", now: true }], ["hint", { key: "story.hint.torch", bind: "flashlight" }],
          ["doors", { ids: ["DMUSIC", "DSTAFF", "DR201", "DR202", "DR203", "DR204", "DR205", "DR206", "DR207", "DSTORE2", "DSCIENCE", "DLAB", "DLIBRARY"],
            blocked: { DLIBRARY: "story.hint.libBlocked" } }],
          ["wheel", { id: "back", door: "LIBBACK", answer: "TEMPORARY", word: "temporary", clue: "story.ch1.m.min5",
            at: { x: -40.04, y: 4, z: 6.5, lift: 1.25 }, yaw: -Math.PI / 2, use: { at: { x: -40.3, y: 4, z: 6.0 }, size: [0.8, 2.0, 2.0], lift: 1.0 } }]] },
        { wait: { time: 3 }, do: [["unflag", "read:min"], ["phone", "min4"], ["hint", { key: "story.hint.readMin", bind: "phone" }]] },
        { wait: { lock: "back" }, do: [["objective", "story.ch1.s2.obj3"], ["hint", null], ["npc", { id: "min", show: true }], ["npc", { id: "tonkla", show: true }],
          ["npc", { id: "nam", show: true, talk: 2 }], ["say", [{ who: "nam", line: "story.ch1.d.namIn" }]]] },
        // (inside: the save point -- scene 1-3; not in the middle of a fight -- or half a minute on)
        { wait: { all: [{ zone: "libraryIn" }, { any: [{ calm: true }, { time: 30 }] }] }, do: [["checkpoint"], ["next"]] },
      ],
      on: [
        // (beside the beats, so that nothing waits on the phone being read: the lock can be found first)
        { id: "dirRead", after: "msg:min4", when: { read: "min" }, do: [["hint", null], ["flag", "dirRead"]] },
        { id: "found", when: { any: [{ tried: "door:DLIBRARY" }, { zone: "libraryBack" }] }, do: [["flag", "foundLib"]] },
        // found: the front door tried (barricaded), or the back door reached -- Kru Min: the back door, its clue
        { id: "clue", when: { all: [{ flag: "foundLib" }, { not: { lock: "back" } }] }, do: [["objective", "story.ch1.s2.obj2"], ["unflag", "read:min"], ["phone", "min5"]] },
        // a minute gone by with the directions and nothing found: Kru Min's hint
        { id: "hint60", after: "dirRead", when: { all: [{ time: 60 }, { not: { flag: "foundLib" } }, { not: { used: "door:DMUSIC" } }] },
          do: [["unflag", "read:min"], ["phone", "min6"]] },
        // the wrong door: a Shambler hiding in the store room
        { id: "store", when: { used: "door:DSTORE2" }, do: [["spawn", { id: "st", at: "store2In", count: 1, kinds: ["normal"] }]] },
        // the lock turned: Sprinters in PE kit from the PE room's side; Nam's clue after two wrong words
        { id: "sprint", after: "lockopen:back", when: { all: [{ time: 2.5 }, { not: { lock: "back" } }] }, do: [["spawn", { id: "spr", at: "wing2", count: 3, kinds: ["fast"] }], ["sys", { key: "story.ch1.sys.movement", glitch: true }]] },
        { id: "back", after: "on:sprint", when: { all: [{ cleared: "spr" }, { not: { lock: "back" } }] }, do: [["hint", { key: "story.hint.lockBack", bind: "interact" }]] },
        { id: "nam", when: { flag: "lockwrong:back:2" }, do: [["npc", { id: "nam", talk: 2 }], ["say", [{ who: "nam", line: "story.ch1.d.namHint" }]]] },
      ] },
    // (round 7) 1-3 The Last Classroom (7-8 minutes): the library, the group's base. Kru Min, Fai,
    // Tonkla and Nam; the music down, nobody to fight; three choices (what the glasses show, where
    // Beam is, his symptoms -- a word question in the talk: a wrong answer corrected, as a teacher
    // would, and counted as any answer); a short look round (Beam's notebook, the sponsor's sign);
    // the doors banged on -- two bookshelves pushed across them, the button held, Tonkla pushing too;
    // the save; three waves through the windows and the air vents, Crawlers under the reading tables,
    // 15 seconds between two to push back what the banging moved (a door whose shelf is not back
    // gives); Fai shouting where they come from, Nam reading her dictionary after wrong shots; the last
    // wave's window broken on Tonkla's arm; the phones dead -- the PA has power of its own; not yet.
    { id: "s3", title: "story.ch1.s3", objective: "story.ch1.s3.obj0", start: { x: -37.6, y: 4, z: 5.0, yaw: -Math.PI / 2 }, clock: "09:30", light: "library",
      doors: { LIBBACK: true, DLIBRARY: false, STAIRB2: false, DPE: false, DSTOREW: false, DWC2: false, DNURSE: false },
      hints: { who: "nam", after: 2 },
      push: [
        { id: "back", kind: "bookshelf", o: { w: 1 }, from: { x: -38.75, y: 4, z: 7.5, yaw: Math.PI / 2 }, to: { x: -38.75, z: 5.5 },
          need: { flag: "x:barricade" }, help: "tonkla", helpAt: { x: -38.1, z: 8.45 } },
        { id: "front", kind: "bookshelf", o: { w: 1 }, from: { x: -27.7, y: 4, z: 4.4, yaw: 0.4 }, to: { x: -25.5, z: 3.25, yaw: 0 }, start: 1,
          need: { flag: "x:barricade" }, help: "tonkla", helpAt: { x: -28.5, z: 5.2 } },
      ],
      props: [
        // Beam's notebook, on the reading table he always sat at
        { id: "notebook", kind: "papers", at: { x: -27.4, y: 4.77, z: 6.4 }, yaw: 0.3 },
      ],
      // (where 1-2 left them by the back door; Fai further in)
      cast: [
        { id: "min", who: "min", at: { x: -37, y: 4, z: 5.5 }, yaw: -Math.PI / 2 }, { id: "nam", who: "nam", at: { x: -36.6, y: 4, z: 4.3 }, yaw: -Math.PI / 2 + 0.3 },
        { id: "tonkla", who: "tonkla", at: { x: -37.4, y: 4, z: 6.9 }, yaw: -Math.PI / 2 - 0.3 }, { id: "fai", who: "fai", at: { x: -32.8, y: 4, z: 4.3 }, yaw: -Math.PI / 2, face: "player" },
      ],
      beats: [
        // the meeting: the music down, nobody to fight
        { do: [["objective", "story.ch1.s3.obj0"], ["sound", "calm"], ["hint", null],
          ["npc", { id: "min", walk: [{ x: -34.4, z: 4.8 }], then: { face: "player" } }],
          ["npc", { id: "nam", walk: [{ x: -35.6, z: 5.3 }, { x: -35.6, z: 5.98 }], then: { pose: "sit", face: Math.PI } }],
          ["npc", { id: "tonkla", walk: [{ x: -37.3, z: 7.9 }], then: { face: "player" } }]] },
        { wait: { any: [{ near: { id: "min", r: 3.6 } }, { time: 6 }] }, do: [["npc", { id: "min", talk: 3, face: "player" }],
          ["ask", { id: "lens", who: "min", line: "story.ch1.d.minLens", options: [{ text: "story.ch1.c.lensWords", value: "words" }, { text: "story.ch1.c.lensLeft", value: "left" }],
            then: [[{ who: "min", line: "story.ch1.d.minFight" }], [{ who: "min", line: "story.ch1.d.minFight" }]] }]] },
        { wait: { all: [{ chosen: "lens" }, { said: true }] }, do: [["ask", { id: "beam", who: "min", line: "story.ch1.d.minBeam",
          options: [{ text: "story.ch1.c.beamTurned", value: "turned" }, { text: "story.ch1.c.beamDunno", value: "dunno" }],
          then: [[{ who: "min", line: "story.ch1.d.minSeen" }], [{ who: "min", line: "story.ch1.d.minSeen" }]] }]] },
        // (the last a word question: "symptoms" again, from 1-1's notice -- counted as any answer)
        { wait: { all: [{ chosen: "beam" }, { said: true }] }, do: [["ask", { id: "sym", who: "min", line: "story.ch1.d.minSym", quiz: { word: "symptom", kind: "cloze" },
          options: [{ text: "story.ch1.c.symptoms", value: "symptoms", right: true }, { text: "story.ch1.c.systems", value: "systems" }, { text: "story.ch1.c.sympathy", value: "sympathy" }],
          right: [{ who: "min", line: "story.ch1.d.minSymRight" }], wrong: [{ who: "min", line: "story.ch1.d.minSymWrong" }] }]] },
        // a short look round (the design's: no must) -- Beam's notebook, the sponsor's sign
        { wait: { all: [{ chosen: "sym" }, { said: true }] }, do: [["objective", "story.ch1.s3.obj1"], ["hint", "story.hint.lookRound"],
          ["use", { id: "notebook", at: { x: -27.4, y: 4, z: 6.4 }, size: [0.8, 0.5, 0.7], lift: 0.86, prompt: "story.use.notebook", sound: "paper" }],
          ["use", { id: "sponsor", at: { x: -31.5, y: 4, z: 3.35 }, size: [2.6, 0.9, 0.5], lift: 2.45, prompt: "story.use.sponsor", sound: "" }]] },
        // the doors banged on: the front door's shelf knocked back -- "Help me barricade the doors!"
        { wait: { any: [{ time: 30 }, { all: [{ card: "notebook" }, { card: "sponsor" }] }] }, do: [["hint", null], ["unuse", "notebook"], ["unuse", "sponsor"], ["sound", "quiet"],
          ["thud", { at: { x: -25.5, y: 4, z: 2.2 }, n: 5, gap: 0.26 }], ["nudge", { id: "front", by: 0.62 }], ["sound", "sting"], ["shake", { sec: 0.3, amp: 0.03 }],
          ["door", { id: "LIBBACK", open: false }], ["sound", "slam"], ["flag", "x:barricade"], ["objective", "story.ch1.s3.obj2"],
          ["npc", { id: "nam", pose: "stand", walk: [{ x: -34.2, z: 4.4 }], then: { face: { x: -25.5, z: 3 } } }],
          ["say", [{ who: "fai", line: "story.ch1.d.faiDoor" }, { who: "min", line: "story.ch1.d.minBarricade" }]],
          ["hint", { key: "story.hint.push", bind: "interact" }]] },
        // both across: the save (the design's: before the defence)
        { wait: { all: [{ pushed: "back" }, { pushed: "front" }] }, do: [["hint", null], ["say", [{ who: "tonkla", line: "story.ch1.d.tonklaHeld" }, { who: "min", line: "story.ch1.d.minWindows" }]],
          ["checkpoint", { x: -31.5, y: 4, z: 4.6, yaw: Math.PI }]] },
        // the defence (also the first beat of a run picked up at that save): everyone to their place
        { do: [["objective", "story.ch1.s3.obj"], ["sound", "tense"], ["sys", { key: "story.ch1.sys.defend", glitch: true }], ["door", { id: "LIBBACK", open: false }],
          ["npc", { id: "min", pose: "stand", walk: [{ x: -31.5, z: 4.0 }], then: { face: { x: -31.5, z: 9 } } }],
          ["npc", { id: "fai", pose: "stand", walk: [{ x: -29.0, z: 3.9 }], then: { face: { x: -30, z: 9 } } }],
          ["npc", { id: "nam", pose: "stand", walk: [{ x: -33.9, z: 3.9 }], then: { face: { x: -33, z: 9 } } }],
          ["npc", { id: "tonkla", pose: "stand", walk: [{ x: -37.6, z: 4.3 }], then: { face: { x: -38.75, z: 5.5 } } }]] },
        // wave 1: through the windows
        { wait: { time: 3 }, do: [["flag", "x:wave1"], ["spawn", { id: "w1", at: "libWindows", count: 4, kinds: ["normal"] }], ["callout", { who: "fai", at: "libWindows" }]] },
        { wait: { all: [{ time: 2 }, { calm: true }] }, do: [["flag", "x:rest1"], ["timer", { key: "story.timer.wave", sec: 15 }]] },
        // wave 2: the air vents -- Crawlers, under the tables -- and the windows; a door whose shelf is not back gives
        { wait: { time: 15 }, do: [["timer", null], ["hint", null], ["flag", "x:wave2"], ["sfx", { name: "vent_clang", at: { x: -31.5, y: 4, z: 8.8 }, lift: 2.6 }],
          ["spawn", { id: "w2", at: "libVents", count: 3, kinds: ["crawler"] }], ["spawn", { id: "w2b", at: "libWindows", count: 2, kinds: ["normal"] }],
          ["callout", { who: "fai", line: "story.ch1.d.faiVent" }], ["sys", { key: "story.ch1.sys.crawler", glitch: true }],
          ["if", { when: { not: { pushed: "front" } }, do: [["spawn", { id: "w2f", at: "libFrontIn", count: 2, kinds: ["normal"] }], ["thud", { at: { x: -25.5, y: 4, z: 2.2 }, n: 3 }]] }],
          ["if", { when: { not: { pushed: "back" } }, do: [["spawn", { id: "w2k", at: "libBackIn", count: 2, kinds: ["normal"] }], ["thud", { at: { x: -40, y: 4, z: 5.5 }, n: 3 }]] }]] },
        { wait: { all: [{ time: 2 }, { calm: true }] }, do: [["flag", "x:rest2"], ["timer", { key: "story.timer.wave", sec: 15 }]] },
        // wave 3: all of it -- and Tonkla to the north-west window, to hold it
        { wait: { time: 15 }, do: [["timer", null], ["hint", null], ["flag", "x:wave3"],
          ["spawn", { id: "w3", at: "libWindows", count: 3, kinds: ["normal", "normal", "fast"] }], ["spawn", { id: "w3b", at: "libVents", count: 2, kinds: ["crawler"] }],
          ["callout", { who: "fai", at: "libWindows" }],
          ["npc", { id: "tonkla", pose: "stand", walk: [{ x: -36.9, z: 8.2 }], speed: 2.4, then: { pose: "push", face: { x: -36.9, z: 9.6 } } }],
          ["if", { when: { not: { pushed: "front" } }, do: [["spawn", { id: "w3f", at: "libFrontIn", count: 2, kinds: ["normal"] }], ["thud", { at: { x: -25.5, y: 4, z: 2.2 }, n: 3 }]] }],
          ["if", { when: { not: { pushed: "back" } }, do: [["spawn", { id: "w3k", at: "libBackIn", count: 2, kinds: ["normal"] }], ["thud", { at: { x: -40, y: 4, z: 5.5 }, n: 3 }]] }]] },
        // ...the window gives on him: his arm cut (scene 1-4's errand); two climb in through it
        { wait: { time: 6 }, do: [["glass", { at: { x: -36.9, y: 5.6, z: 9.0 }, dir: { x: 0, z: -1 } }],
          ["npc", { id: "tonkla", pose: "hurt", talk: 1.6, walk: [{ x: -35.8, z: 5.2 }], speed: 1.8, then: { pose: "hurt", face: "player" } }],
          ["say", [{ who: "tonkla", line: "story.ch1.d.tonklaArm" }, { who: "fai", line: "story.ch1.d.faiTonkla" }]],
          ["spawn", { id: "w3c", at: "libNW", count: 2, kinds: ["normal"] }]] },
        // held: the phones dead -- the PA system has power of its own; but not yet
        { wait: { all: [{ time: 2 }, { calm: true }] }, do: [["flag", "x:held"], ["timer", null], ["hint", null], ["sound", "calm"], ["objective", "story.ch1.s3.obj4"],
          ["npc", { id: "min", walk: [{ x: -33.2, z: 4.9 }], then: { face: "player" } }],
          ["say", [{ who: "min", line: "story.ch1.d.minPhones" }, { who: "min", line: "story.ch1.d.minPA" }, { who: "min", line: "story.ch1.d.minWait" }]]] },
        { wait: { said: true }, do: [["checkpoint"], ["next"]] },
      ],
      on: [
        // the look round: what is read
        { id: "notebook", when: { used: "notebook" }, do: [["card", { id: "notebook", icon: "📓", title: "story.card.notebookTitle", lines: ["story.ch1.notebook1", "story.ch1.notebook2"] }]] },
        { id: "sponsor", when: { used: "sponsor" }, do: [["card", { id: "sponsor", icon: "🪧", title: "story.card.sponsorTitle", lines: ["story.ch1.sponsor"] }]] },
        // during the waves the doors are banged on: a shelf knocked back (pushed back between two waves)
        { id: "bang1", after: "x:wave1", when: { time: 8 }, do: [["thud", { at: { x: -25.5, y: 4, z: 2.2 }, n: 4 }], ["nudge", { id: "front", by: 0.4 }], ["callout", { who: "fai", line: "story.ch1.d.faiFront" }]] },
        { id: "bang2", after: "x:wave2", when: { time: 6 }, do: [["thud", { at: { x: -40, y: 4, z: 5.5 }, n: 4 }], ["nudge", { id: "back", by: 0.45 }], ["callout", { who: "fai", line: "story.ch1.d.faiBack" }]] },
        // between two waves, a shelf out of place (knocked back before or during the rest): the hint, Kru Min's word
        { id: "pushBack1", after: "x:rest1", when: { all: [{ not: { flag: "x:wave2" } }, { any: [{ not: { pushed: "back" } }, { not: { pushed: "front" } }] }] },
          do: [["hint", { key: "story.hint.pushBack", bind: "interact" }], ["say", [{ who: "min", line: "story.ch1.d.minPushBack" }]]] },
        { id: "pushBack2", after: "x:rest2", when: { all: [{ not: { flag: "x:wave3" } }, { any: [{ not: { pushed: "back" } }, { not: { pushed: "front" } }] }] },
          do: [["hint", { key: "story.hint.pushBack", bind: "interact" }], ["say", [{ who: "min", line: "story.ch1.d.minPushBack" }]]] },
        { id: "bang3", after: "x:wave3", when: { time: 10 }, do: [["thud", { at: { x: -25.5, y: 4, z: 2.2 }, n: 4 }], ["nudge", { id: "front", by: 0.3 }]] },
      ] },
    // (round 7) 1-4 First Aid (4-6 minutes): quiet, after the defence. Tonkla's cut is glass, not a bite
    // -- no infection (how it spreads, in a line); Kru Min's list by text; the west wing under 30 m,
    // desks knocked over and Crawlers under them; the nurse's room in its cold light -- Nurse Pim
    // turned, still on a bed, REST over her: she gets up within 3 m or at a shot in her room (shot or
    // walked round: the player's choice, nothing follows from it); the cabinet's six boxes by their
    // labels, a wrong one's card; the nurse's logbook (17 students, three weeks); Sprinters from the
    // main stairs' side on the way back; Fai sees to the arm -- "You'll recover. Stop talking."
    { id: "s4", title: "story.ch1.s4", objective: "story.ch1.s4.obj0", start: { x: -37.6, y: 4, z: 5.0, yaw: -Math.PI / 2 }, clock: "10:15", light: "nurse",
      doors: { LIBBACK: true, DLIBRARY: false, STAIRB2: false, DPE: false, DSTOREW: false, DWC2: false, DNURSE: true, STAIRM2: false },
      push: [
        // (the back door's shelf moved aside for the player; the front door's in place)
        { id: "back", kind: "bookshelf", o: { w: 1 }, from: { x: -38.75, y: 4, z: 7.5, yaw: Math.PI / 2 }, to: { x: -38.75, z: 5.5 }, need: { flag: "never" } },
        { id: "front", kind: "bookshelf", o: { w: 1 }, from: { x: -27.7, y: 4, z: 4.4, yaw: 0.4 }, to: { x: -25.5, z: 3.25, yaw: 0 }, start: 1, need: { flag: "never" } },
      ],
      props: [
        // the west wing's corridor: desks and chairs knocked over (the way picked through them)
        { id: "fd1", kind: "deskSet", at: { x: -41.1, y: 4, z: -5.6 }, yaw: 0.3, rz: Math.PI / 2 },
        { id: "fd2", kind: "deskSet", at: { x: -43.0, y: 4, z: -9.6 }, yaw: -0.5, rx: Math.PI / 2 },
        { id: "fd3", kind: "deskSet", at: { x: -41.3, y: 4, z: -13.6 }, yaw: 0.9, rz: -Math.PI / 2 },
        { id: "ch1", kind: "chair", at: { x: -42.7, y: 4, z: -7.3 }, yaw: 0.4, rz: Math.PI / 2 }, { id: "ch2", kind: "chair", at: { x: -41.8, y: 4, z: -11.7 }, yaw: -1.1, rx: -Math.PI / 2 },
        // the nurse's logbook, open on her desk
        { id: "logbook", kind: "papers", at: { x: -41.0, y: 4.77, z: -21.8 }, yaw: 1.2 },
      ],
      cast: [
        { id: "min", who: "min", at: { x: -36.3, y: 4, z: 5.0 }, yaw: Math.PI / 2, face: "player" },
        { id: "tonkla", who: "tonkla", at: { x: -35.6, y: 4, z: 5.98 }, yaw: Math.PI, pose: "hurtSit" },
        { id: "fai", who: "fai", at: { x: -34.6, y: 4, z: 5.2 }, yaw: -Math.PI / 2 - 0.5, face: { x: -35.6, z: 5.98 } },
        { id: "nam", who: "nam", at: { x: -33.0, y: 4, z: 4.5 }, yaw: -Math.PI / 2, face: "player" },
        // in the nurse's room: Nurse Pim, turned, sitting still on a bed -- REST over her
        { id: "pim", who: "pim_z", at: { x: -47.05, y: 4, z: -25.0 }, yaw: Math.PI / 2, pose: "sit", seat: 0.62, label: { word: "REST" } },
      ],
      beats: [
        // a cut from the glass, not a bite: no infection
        { do: [["objective", "story.ch1.s4.obj0"], ["sound", "quiet"], ["hint", null],
          ["npc", { id: "min", walk: [{ x: -35.9, z: 5.15 }], then: { face: { x: -35.6, z: 5.98 }, pose: "treat" } }],
          ["say", [{ who: "tonkla", line: "story.ch1.d.tonklaTurn" }, { who: "min", line: "story.ch1.d.minInjury" }, { who: "min", line: "story.ch1.d.minNurse" }]]] },
        // the list, by text; the cabinet and the logbook to use in the nurse's room
        { wait: { said: true }, do: [["npc", { id: "min", pose: "stand", face: "player" }], ["unflag", "read:min"], ["phone", "min7"], ["hint", { key: "story.hint.readMin", bind: "phone" }],
          ["objective", "story.ch1.s4.obj"],
          ["pick", { id: "meds", at: { x: -41.2, y: 4, z: -26.35 }, size: [1.3, 1.8, 0.7], lift: 0.95, prompt: "story.use.cabinet", icon: "💊", title: "story.pick.title", who: "min", line: "story.ch1.m.min7",
            items: ["bandage", "cough syrup", "antiseptic", "eye drops", "gauze", "ice pack"], want: ["bandage", "antiseptic", "gauze"] }],
          ["use", { id: "logbook", at: { x: -41.0, y: 4, z: -21.8 }, size: [0.8, 0.45, 1.0], lift: 0.86, prompt: "story.use.logbook", sound: "paper" }]] },
        // all three in the bag: back
        { wait: { picked: "meds" }, do: [["objective", "story.ch1.s4.obj2"], ["hint", null]] },
        // in the library, the fight over (or a while on): the door shut behind, the shelf back; Fai and the bandage
        { wait: { all: [{ zone: "libraryDeep" }, { any: [{ calm: true }, { time: 45 }] }] }, do: [["door", { id: "LIBBACK", open: false }], ["sound", "slam"], ["push", { id: "back", p: 1 }],
          ["sound", "calm"], ["objective", "story.ch1.s4.obj3"],
          ["npc", { id: "min", walk: [{ x: -36.8, z: 4.6 }], then: { face: "player" } }],
          ["npc", { id: "fai", walk: [{ x: -35.6, z: 5.3 }], then: { face: { x: -35.6, z: 5.98 }, pose: "treat" } }],
          ["say", [{ who: "fai", line: "story.ch1.d.faiBandage" }, { who: "tonkla", line: "story.ch1.d.tonklaDoctor" }, { who: "fai", line: "story.ch1.d.faiRecover" }]]] },
        { wait: { said: true }, do: [["checkpoint"], ["next"]] },
      ],
      on: [
        { id: "dirRead", after: "msg:min7", when: { read: "min" }, do: [["hint", null]] },
        // the corridor: Crawlers out from under the desks
        { id: "crawl", when: { zone: "wingIn" }, do: [["spawn", { id: "cr", at: "wingDesks", count: 3, kinds: ["crawler"] }], ["sys", { key: "story.ch1.sys.floor", glitch: true }]] },
        // into her room: what to do about her
        { id: "pimSeen", when: { zone: "nurse" }, do: [["hint", "story.hint.pim"]] },
        // Nurse Pim gets up: within 3 m, or a shot in her room -- a zombie of her own (REST: practice)
        { id: "pim", when: { any: [{ near: { id: "pim", r: 3 } }, { fired: { s: 0.6, zone: "nurse" } }] }, do: [["npc", { id: "pim", remove: true }], ["hint", null],
          ["spawn", { id: "pim", at: { x: -47.05, y: 4, z: -25.0 }, kinds: ["normal"], words: [{ word: "rest", gloss: CH1_PRACTICE.rest, who: "pim" }], target: "rest" }], ["sound", "sting"]] },
        { id: "log", when: { used: "logbook" }, do: [["card", { id: "logbook", icon: "📔", title: "story.card.logbookTitle", lines: ["story.ch1.logbook"] }]] },
        // the way back: Sprinters from the main stairs' side
        { id: "spr", when: { all: [{ picked: "meds" }, { not: { zone: "nurse" } }] }, do: [["spawn", { id: "spr", at: "corridor2East", count: 4, kinds: ["fast"] }],
          ["sys", { key: "story.ch1.sys.movement", glitch: true }], ["sound", "tense"]] },
        { id: "sprDone", after: "on:spr", when: { cleared: "spr" }, do: [["sound", "quiet"]] },
      ] },
    // (round 8) 1-5 Supply Run (7-9 minutes): the peak in the middle of the chapter. Two hours on, still in the
    // library: Kru Min's errand; down the back stairs to the canteen, breakfast still on the trays -- the
    // first wave; the kitchen behind it: three boxes, two seconds each with the button held, the second wave
    // coming meanwhile (15 in the two, the most in the chapter so far); the walkway to the gym: the save.
    // Coach Ek, FASTER: his charge, his ball, his Sprinters (js/story/miniboss.js) -- stunned against a wall or
    // the vaulting box, the glasses ask for his word among FASTEN and FOSTER, three right ones and he is
    // down, his stopwatch still ticking. The car park: Sgt. Chai's police car, the shotgun, the radio (chapter
    // 2's clue); the way back; the library again, and evening.
    { id: "s5", title: "story.ch1.s5", objective: "story.ch1.s5.obj", start: { x: -37.0, y: 4, z: 4.6, yaw: -Math.PI / 2 }, clock: "12:30", light: "noon", boss: true,
      doors: { LIBBACK: false, DLIBRARY: false, STAIRB2: true, STAIRB1: true, KITCHEN: true, KITCHENB: false, GYMW: false, GYMN: false, LOCKER: false, ENTRANCE: false, DPE: false, DSTOREW: false, DWC2: false, DNURSE: false, STAIRM2: false },
      props: [
        // in the library: both doors' shelves -- the back door's moved aside for the player
        { id: "frontShelf", kind: "bookshelf", o: { w: 1 }, at: { x: -25.5, y: 4, z: 3.25 }, yaw: 0 },
        { id: "backShelf", kind: "bookshelf", o: { w: 1 }, at: { x: -38.75, y: 4, z: 7.5 }, yaw: Math.PI / 2 },
        // in the kitchen: the supplies
        { id: "boxWater", kind: "supplyBoxes", o: { only: "water" }, at: { x: -50.6, y: 0, z: -21.4 }, yaw: 0.2 },
        { id: "boxFood", kind: "supplyBoxes", o: { only: "food" }, at: { x: -45.0, y: 0, z: -20.5 }, yaw: -0.1 },
        { id: "boxTorch", kind: "supplyBoxes", o: { only: "torch" }, at: { x: -40.5, y: 0, z: -21.2 }, yaw: 0.3 },
      ],
      cast: [
        { id: "min", who: "min", at: { x: -34.6, y: 4, z: 4.5 }, yaw: -Math.PI / 2, face: "player" },
        { id: "tonkla", who: "tonkla", at: { x: -35.1, y: 4, z: 5.98 }, yaw: Math.PI, pose: "sit" },
        { id: "fai", who: "fai", at: { x: -34.3, y: 4, z: 5.98 }, yaw: Math.PI, pose: "sit" },
        { id: "nam", who: "nam", at: { x: -33.2, y: 4, z: 4.3 }, yaw: -Math.PI / 2, face: "player" },
        // in the gym, his back to the door: Coach Ek (seen from the walkway's save on)
        { id: "ek", who: "ek_z", at: { x: -26.5, y: 0, z: -32 }, yaw: 2.2, hidden: true, label: { word: "FASTER", depth: true } },
      ],
      beats: [
        // two hours on (a cut): still in the library
        { do: [["black", { on: true, sec: 0 }], ["sound", "stop"], ["hint", null], ["objective", "story.ch1.s5.obj0"], ["teleport", { x: -37.0, y: 4, z: 4.6, yaw: -Math.PI / 2 }],
          ["title", { key: "story.time.noon", sub: "story.ch1.s5.later", sec: 2.6 }]] },
        { wait: { time: 2.8 }, do: [["black", { on: false, sec: 1.2 }], ["sound", "calm"]] },
        // Kru Min's errand
        { wait: { time: 1.4 }, do: [["npc", { id: "min", talk: 3 }], ["say", [{ who: "min", line: "story.ch1.d.minSupply" }]]] },
        { wait: { said: true }, do: [["sound", "quiet"], ["objective", "story.ch1.s5.obj1"], ["door", { id: "LIBBACK", open: true }], ["sound", "door"], ["drop", { kind: "ammo", at: { x: -38.3, y: 4, z: 4.1 } }]] },
        // at the foot of the back stairs: the canteen's first wave is on its way
        { wait: { zone: "backStairs1" }, do: [["flag", "x:w1"], ["objective", "story.ch1.s5.objC"], ["sys", { key: "story.ch1.sys.canteen", glitch: true }], ["sound", "tense"],
          ["spawn", { id: "w1", at: ["canteenFar", "kitchenFar"], count: 7, kinds: ["normal", "normal", "fast", "normal", "normal", "fast", "normal"] }],
          ["drop", { kind: "ammo", at: { x: -50.2, y: 0, z: -3.2 } }], ["drop", { kind: "ammo", at: { x: -41.8, y: 0, z: -16.8 } }], ["drop", { kind: "health", at: { x: -48.6, y: 0, z: -24.6 } }]] },
        // clear: the kitchen's three boxes, two seconds each -- and the second wave behind the player, a box at a time (the rules)
        { wait: { all: [{ time: 2 }, { cleared: "w1" }] }, do: [["flag", "x:boxes"], ["sound", "quiet"], ["objective", "story.ch1.s5.obj2"], ["unflag", "read:min"], ["phone", "min8"],
          ["use", { id: "boxWater", at: { x: -50.6, y: 0, z: -21.4 }, size: [1.0, 1.1, 1.0], lift: 0.5, prompt: "story.use.boxWater", holdSec: 2, sound: "" }],
          ["use", { id: "boxFood", at: { x: -45.0, y: 0, z: -20.5 }, size: [1.0, 1.1, 1.0], lift: 0.5, prompt: "story.use.boxFood", holdSec: 2, sound: "" }],
          ["use", { id: "boxTorch", at: { x: -40.5, y: 0, z: -21.2 }, size: [1.0, 1.1, 1.0], lift: 0.5, prompt: "story.use.boxTorch", holdSec: 2, sound: "" }],
          ["doors", { ids: ["KITCHENB"], blocked: { KITCHENB: "story.hint.suppliesFirst" } }]] },
        { wait: { all: [{ used: "boxWater" }, { used: "boxFood" }, { used: "boxTorch" }] }, do: [["hint", null], ["objective", "story.ch1.s5.obj3"], ["doors", { ids: ["KITCHENB"] }], ["unflag", "read:min"], ["phone", "min9"]] },
        // the walkway: the save (the design's: before the gym), not in the middle of a fight
        { wait: { all: [{ zone: "walkway" }, { any: [{ calm: true }, { time: 30 }] }] }, do: [["checkpoint", { x: -38, y: 0, z: -23, yaw: -Math.PI / 2 }]] },
        // (also the first beat of a run picked up at that save) the gym's door, a stopwatch ticking behind it
        { do: [["unprop", "boxWater"], ["unprop", "boxFood"], ["unprop", "boxTorch"], ["door", { id: "KITCHENB", open: true }], ["objective", "story.ch1.s5.obj4"], ["sound", "quiet"], ["sound", "tick"],
          ["doors", { ids: ["GYMW"] }], ["npc", { id: "ek", show: true }],
          ["drop", { kind: "ammo", at: { x: -34.6, y: 0, z: -42.6 } }], ["drop", { kind: "ammo", at: { x: -12.4, y: 0, z: -38.4 } }], ["drop", { kind: "ammo", at: { x: -34.6, y: 0, z: -30.6 } }], ["drop", { kind: "health", at: { x: -12.4, y: 0, z: -42.8 } }]] },
        // in: the door shut behind, Coach Ek turns round
        { wait: { zone: "gymIn" }, cine: "ek", do: [["door", { id: "GYMW", open: false }], ["sound", "slam"], ["bars", true], ["lock", true], ["look", { x: -26.5, y: 1.35, z: -32, sec: 1.1 }], ["sys", { key: "story.ch1.sys.ek", glitch: true }]] },
        { wait: { all: [{ looked: true }, { time: 1.6 }] }, cine: "ek", do: [["npc", { id: "ek", face: "player" }]] },
        { wait: { time: 1.2 }, do: [["bars", false], ["lock", false], ["npc", { id: "ek", remove: true }], ["sound", "untick"], ["sound", "tense"], ["objective", "story.ch1.s5.obj5"],
          ["boss", { id: "ek", who: "ek", name: "story.who.ek", word: "faster", gloss: CH1_PRACTICE.faster, at: { x: -26.5, y: 0, z: -32 }, yaw: -0.96, firstGap: 0.4, center: { x: -23, z: -34.5 },
            decoys: [{ word: "fasten", gloss: CH1_PRACTICE.fasten }, { word: "foster", gloss: CH1_PRACTICE.foster }], adds: "lockerRoom", door: "LOCKER", line: "story.ch1.d.ekFaster", ask: "story.ch1.sys.shoot",
            moves: ["faster", "charge", "ball", "charge", "faster", "charge", "ball", "charge"], drop: { id: "watch", prompt: "story.use.watch" } }]] },
        // down: whoever is left of his Sprinters, then the car park's door
        { wait: { boss: "ek" }, do: [["sound", "quiet"], ["slow", 1.2], ["hint", null], ["objective", "story.ch1.s5.obj6"]] },
        { wait: { all: [{ time: 2.5 }, { any: [{ calm: true }, { time: 40 }] }] }, do: [["door", { id: "GYMN", open: true }], ["sound", "door"], ["objective", "story.ch1.s5.obj7"],
          ["use", { id: "car", at: { x: -24, y: 0, z: -58 }, size: [4.6, 1.8, 2.4], lift: 0.9, prompt: "story.use.car", sound: "" }]] },
        // Sgt. Chai's car: the shotgun, its rounds; the radio; a save
        { wait: { used: "car" }, do: [["flag", "x:gun"], ["sound", "door"], ["give", { gun: "shotgun", rounds: 18 }], ["hint", "story.hint.shotgun"], ["sound", "static"], ["say", [{ who: "radio", line: "story.ch1.d.radioUnits" }]],
          ["checkpoint", { x: -24, y: 0, z: -54.6, yaw: Math.PI }]] },
        // (also the first beat of a run picked up there) back the way they came: Shamblers in the gym to try it on
        { do: [["door", { id: "GYMN", open: true }], ["door", { id: "GYMW", open: true }], ["door", { id: "KITCHENB", open: true }], ["door", { id: "LIBBACK", open: true }], ["unprop", "boxWater"], ["unprop", "boxFood"], ["unprop", "boxTorch"],
          ["objective", "story.ch1.s5.obj8"]] },
        { wait: { time: 4 }, do: [["spawn", { id: "rt", at: "gymFloor", count: 5, kinds: ["normal"] }], ["sys", { key: "story.ch1.sys.gym", glitch: true }]] },
        // in the library: the door shut; then a cut -- they eat, they rest, the light goes gold
        { wait: { all: [{ zone: "libraryDeep" }, { any: [{ calm: true }, { time: 30 }] }] }, do: [["door", { id: "LIBBACK", open: false }], ["sound", "slam"], ["sound", "calm"], ["hint", null], ["objective", "story.ch1.s5.obj9"],
          ["npc", { id: "tonkla", pose: "stand", face: "player", talk: 2.6 }], ["npc", { id: "fai", pose: "stand", face: "player" }], ["say", [{ who: "tonkla", line: "story.ch1.d.tonklaRun" }]]] },
        { wait: { said: true }, do: [["black", { on: true, sec: 1 }]] },
        { wait: { time: 1.3 }, do: [["light", "golden"], ["heal", true], ["teleport", { x: -33.6, y: 4, z: 4.2, yaw: Math.PI }], ["prop", { id: "eaten", kind: "supplyBoxes", at: { x: -36.4, y: 4, z: 4.0 }, yaw: 0.4 }],
          ["npc", { id: "tonkla", to: { x: -35.9, y: 4, z: 5.98, yaw: Math.PI }, pose: "sit", face: Math.PI }], ["npc", { id: "fai", to: { x: -35.0, y: 4, z: 5.98, yaw: Math.PI }, pose: "sit", face: Math.PI }],
          ["npc", { id: "nam", to: { x: -31.9, y: 4, z: 5.98, yaw: Math.PI }, pose: "sit", face: Math.PI }], ["npc", { id: "min", to: { x: -33.4, y: 4, z: 8.3, yaw: 0 }, face: 0 }],
          ["title", { key: "story.time.evening", sub: "story.ch1.s5.evening", sec: 2.6 }]] },
        { wait: { time: 2.8 }, do: [["black", { on: false, sec: 1.4 }]] },
        { wait: { time: 1.8 }, do: [["npc", { id: "min", face: "player", talk: 3 }], ["say", [{ who: "min", line: "story.ch1.d.minTime" }]]] },
        { wait: { said: true }, do: [["sound", "quiet"], ["door", { id: "LIBBACK", open: true }], ["sound", "door"], ["checkpoint"], ["next"]] },
      ],
      on: [
        // at the kitchen's boxes: how (once the canteen is clear)
        { id: "take", after: "x:boxes", when: { zone: "kitchenIn" }, do: [["hint", { key: "story.hint.take", bind: "interact" }]] },
        { id: "bw", when: { used: "boxWater" }, do: [["unprop", "boxWater"], ["give", { item: "story.item.water" }]] },
        { id: "bf", when: { used: "boxFood" }, do: [["unprop", "boxFood"], ["give", { item: "story.item.food" }]] },
        { id: "bt", when: { used: "boxTorch" }, do: [["unprop", "boxTorch"], ["give", { item: "story.item.torch" }]] },
        // the second wave, in two parts: the first box taken, the second -- up from the back stairs
        { id: "one", when: { any: [{ used: "boxWater" }, { used: "boxFood" }, { used: "boxTorch" }] }, do: [["objective", "story.ch1.s5.obj2b"], ["hint", null], ["sound", "tense"],
          ["spawn", { id: "w2a", at: "backStairsFoot", count: 4, kinds: ["fast", "normal", "fast", "normal"] }], ["sys", { key: "story.ch1.sys.more", glitch: true }]] },
        { id: "two", when: { any: [{ all: [{ used: "boxWater" }, { used: "boxFood" }] }, { all: [{ used: "boxWater" }, { used: "boxTorch" }] }, { all: [{ used: "boxFood" }, { used: "boxTorch" }] }] },
          do: [["objective", "story.ch1.s5.obj2c"], ["spawn", { id: "w2b", at: "backStairsFoot", count: 4, kinds: ["fast", "normal", "normal", "fast"] }], ["drop", { kind: "ammo", at: { x: -46.4, y: 0, z: -24.6 } }]] },
        { id: "held", after: "on:two", when: { all: [{ cleared: "w2a" }, { cleared: "w2b" }] }, do: [["sound", "quiet"]] },
        // the stopwatch he dropped, still running (round 11's collectibles)
        { id: "watch", when: { used: "watch" }, do: [["flag", "found:stopwatch"], ["card", { id: "watch", icon: "⏱️", title: "story.card.watchTitle", lines: ["story.ch1.watch"] }]] },
      ] },
    // (round 9) 1-6 Attention, All Students (6-8 minutes): late afternoon, the light gold. Kru Min down the back
    // stairs to the PR room, next to the admin office: she walks behind the player, the extinguisher in her hands
    // (js/story/escort.js). The Smart PA has scrambled the announcement: three gaps put right (js/story/pa.js), the
    // save, the microphone button, the school's bells -- and Kru Min reads out what the player mended. It repeats
    // every twenty seconds and draws them in: a hundred seconds held, the two rooms and the corridor's doors, the
    // first Screamers; then, one by one, the messages of who heard it. From the office's window: the principal.
    { id: "s6", title: "story.ch1.s6", objective: "story.ch1.s6.obj0", start: { x: -34.6, y: 4, z: 4.4, yaw: Math.PI / 2 }, clock: "17:00", light: "golden",
      doors: { LIBBACK: true, DLIBRARY: false, STAIRB2: true, STAIRB1: true, KITCHENB: false, ENTRANCE: false, DPE: false, DSTOREW: false, DWC2: false, DNURSE: false, STAIRM2: false, DPR: false, DADMIN: false, PRADMIN: true },
      shriek: { at: ["corr1West", "corr1East"], count: 2, kinds: ["normal", "fast"], max: 8 },
      props: [
        // in the library, as 1-5 left it
        { id: "frontShelf", kind: "bookshelf", o: { w: 1 }, at: { x: -25.5, y: 4, z: 3.25 }, yaw: 0 },
        { id: "backShelf", kind: "bookshelf", o: { w: 1 }, at: { x: -38.75, y: 4, z: 7.5 }, yaw: Math.PI / 2 },
        { id: "eaten", kind: "supplyBoxes", at: { x: -36.4, y: 4, z: 4.0 }, yaw: 0.4 },
        // on the principal's desk
        { id: "contract", kind: "papers", at: { x: 10.6, y: 0.77, z: 5.2 }, yaw: 0.5 },
      ],
      cast: [
        { id: "min", who: "min", at: { x: -33.4, y: 4, z: 8.3 }, yaw: 0, face: "player" },
        { id: "tonkla", who: "tonkla", at: { x: -35.9, y: 4, z: 5.98 }, yaw: Math.PI, pose: "sit" },
        { id: "fai", who: "fai", at: { x: -35.0, y: 4, z: 5.98 }, yaw: Math.PI, pose: "sit" },
        { id: "nam", who: "nam", at: { x: -31.9, y: 4, z: 5.98 }, yaw: Math.PI, pose: "sit" },
        // in front of the flagpole (seen from the office's window, once it has been held)
        { id: "somsak", who: "somsak_z", at: { x: -2.2, y: 0, z: 15.4 }, yaw: Math.PI - 0.55, pose: "megaphone", carry: { kind: "megaphone", at: [0.06, 1.5, 0.3], scale: 1.2 }, hidden: true },
      ],
      beats: [
        // (a save of an earlier build began this scene on the ground floor: in the library, then)
        { do: [["if", { when: { not: { zone: "libraryDeep" } }, do: [["teleport", { x: -34.6, y: 4, z: 4.4, yaw: Math.PI / 2 }]] }], ["hint", null], ["sound", "quiet"], ["objective", "story.ch1.s6.obj0"],
          ["escort", { id: "min" }], ["npc", { id: "min", talk: 3 }], ["say", [{ who: "min", line: "story.ch1.d.minStay" }, { who: "min", line: "story.ch1.d.minLead" }]],
          ["if", { when: { not: { flag: "found:contract" } }, do: [["use", { id: "contract", at: { x: 10.6, y: 0, z: 5.2 }, size: [0.9, 0.45, 0.8], lift: 0.86, prompt: "story.use.contract", sound: "paper" }]] }], ["doors", { ids: ["DPR"] }]] },
        { wait: { said: true }, do: [["objective", "story.ch1.s6.obj1"], ["hint", { key: "story.hint.escort", bind: "interact", sec: 8 }]] },
        // in the PR room, the two of them, the corridor quiet (or a while on): LEXA's jingle, broken; the draft
        { wait: { all: [{ zone: "prIn" }, { near: { id: "min", r: 5 } }, { escort: "up" }, { any: [{ calm: true }, { time: 30 }] }] }, do: [["flag", "x:pr"], ["sound", "quiet"], ["sound", "bent"], ["hint", null], ["objective", "story.ch1.s6.obj"],
          ["escort", { id: "min", stay: { x: -12.1, y: 0, z: 5.05, face: { x: -11.9, z: 4.1 } }, pose: "console" }], ["say", [{ who: "min", line: "story.ch1.d.minScrambled" }]]] },
        { wait: { time: 1.2 }, do: [["pa", { id: "pa", at: { x: -11.5, y: 0, z: 4.2 }, size: [1.8, 1.3, 1.0], lift: 0.8, prompt: "story.use.pa", title: "story.pa.title", who: "min", line: "story.ch1.d.minScrambled", text: "story.ch1.pa.draft",
          gaps: [{ options: ["evacuate", "evaluate"], right: "evacuate", line: "story.ch1.d.minEvaluate" },
            { options: ["afford", "avoid"], right: "avoid", line: "story.ch1.d.minAfford", cap: true },
            { options: ["assemble", "assume"], right: "assemble", line: "story.ch1.d.minAssume", cap: true }] }]] },
        // put right: is help really on the way? -- and the save (the design's: before the hold), not in the middle of a fight
        { wait: { pa: "pa" }, do: [["sound", "unbent"], ["ask", { id: "help", who: "min", line: "story.ch1.pa.l5", options: [{ text: "story.ch1.c.helpAsk", value: "ask" }, { text: "story.ch1.c.helpGo", value: "go" }],
          then: [[{ who: "min", line: "story.ch1.d.minHelp" }, { who: "min", line: "story.ch1.d.minPress" }], [{ who: "min", line: "story.ch1.d.minPress" }]] }]] },
        { wait: { all: [{ chosen: "help" }, { said: true }, { escort: "up" }, { any: [{ calm: true }, { time: 25 }] }] }, do: [["checkpoint", { x: -10.4, y: 0, z: 6.0, yaw: 0.35 }]] },
        // (also the first beat of a run picked up at that save) at the console, the microphone's button; rounds
        { do: [["door", { id: "DPR", open: true }], ["door", { id: "DADMIN", open: false }], ["sound", "quiet"], ["hint", null], ["objective", "story.ch1.s6.obj2"],
          ["escort", { id: "min", stay: { x: -12.1, y: 0, z: 5.05, face: { x: -11.9, z: 4.1 } }, pose: "console", put: true, heal: true }],
          ["drop", { kind: "ammo", at: { x: -14.2, y: 0, z: 6.6 } }], ["drop", { kind: "ammo", at: { x: -1.0, y: 0, z: 7.4 } }], ["drop", { kind: "health", at: { x: -14.2, y: 0, z: 8.0 } }],
          ["if", { when: { not: { flag: "found:contract" } }, do: [["use", { id: "contract", at: { x: 10.6, y: 0, z: 5.2 }, size: [0.9, 0.45, 0.8], lift: 0.86, prompt: "story.use.contract", sound: "paper" }]] }],
          ["use", { id: "mic", at: { x: -11.09, y: 0, z: 4.25 }, size: [0.9, 0.9, 0.9], lift: 1.0, prompt: "story.use.mic", sound: "click" }]] },
        // live: the school's bells, then Kru Min reads it out (listened to, and read)
        { wait: { used: "mic" }, do: [["flag", "x:live"], ["sound", "chimes"], ["objective", "story.ch1.s6.obj3"]] },
        { wait: { time: 5.4 }, do: [["npc", { id: "min", talk: 15 }], ["say", [{ who: "min", line: "story.ch1.pa.l1", voice: true }, { who: "min", line: "story.ch1.pa.l2", voice: true }, { who: "min", line: "story.ch1.pa.l3", voice: true },
          { who: "min", line: "story.ch1.pa.l4", voice: true }, { who: "min", line: "story.ch1.pa.l5", voice: true }]]] },
        // on its loop: held a hundred seconds (who comes, the rules below)
        { wait: { said: true }, do: [["flag", "x:hold"], ["sound", "tense"], ["sys", { key: "story.ch1.sys.office", glitch: true }], ["say", [{ who: "min", line: "story.ch1.d.minHold" }]],
          ["hold", { id: "office", sec: 100, every: 20, key: "story.timer.hold", lines: ["story.ch1.pa.l1", "story.ch1.pa.l2", "story.ch1.pa.l3", "story.ch1.pa.l4", "story.ch1.pa.l5"] }],
          ["spawn", { id: "g0", at: "corr1West", count: 3, kinds: ["normal"], max: 6 }]] },
        { wait: { held: "office" }, do: [["flag", "x:held"], ["hint", null], ["objective", "story.ch1.s6.obj4"], ["say", [{ who: "min", line: "story.ch1.d.minHeld" }]]] },
        // who heard it: the messages, one by one
        { wait: { all: [{ time: 2 }, { escort: "up" }, { any: [{ calm: true }, { time: 40 }] }] }, do: [["sound", "calm"], ["objective", "story.ch1.s6.obj6"], ["phone", "fai1"],
          ["escort", { id: "min", stay: { x: -4.7, y: 0, z: 7.9, face: { x: -2.2, z: 15.4 } } }]] },
        { wait: { time: 3.6 }, do: [["phone", "unk1"]] },
        { wait: { time: 3.6 }, do: [["phone", "unk2"]] },
        { wait: { time: 3 }, do: [["objective", "story.ch1.s6.obj5"], ["use", { id: "window", at: { x: -2.0, y: 0, z: 8.75 }, size: [2.4, 1.8, 0.5], lift: 1.5, prompt: "story.use.window", sound: "" }]] },
        // out of the office's window: the principal at the flagpole, a megaphone in his hand
        { wait: { used: "window" }, cine: "somsak", do: [["bars", true], ["lock", true], ["sound", "quiet"], ["npc", { id: "somsak", show: true }], ["look", { x: -2.2, y: 1.4, z: 15.4, sec: 1.2 }]] },
        { wait: { all: [{ looked: true }, { time: 0.8 }] }, cine: "somsak", do: [["sound", "sting"], ["npc", { id: "min", talk: 4 }], ["say", [{ who: "min", line: "story.ch1.d.minSomsak" }]]] },
        { wait: { said: true }, cine: "somsak", do: [["bars", false], ["lock", false], ["escort", { id: "min", on: false }], ["checkpoint"], ["next"]] },
      ],
      on: [
        // on the way: three ahead as they come out of the back stairs; two behind, half way along; four from the entrance's side
        { id: "e1", when: { zone: "lobby1" }, do: [["spawn", { id: "e1", at: "corr1Mid", count: 3, kinds: ["normal"] }], ["sys", { key: "story.ch1.sys.corr1", glitch: true }], ["drop", { kind: "ammo", at: { x: -30.5, y: 0, z: 1.2 } }]] },
        { id: "e2", when: { zone: "corr1Half" }, do: [["spawn", { id: "e2", at: "backStairsFoot", count: 2, kinds: ["fast"] }]] },
        { id: "e3", when: { zone: "nearPR" }, do: [["spawn", { id: "e3", at: "corr1East", count: 4, kinds: ["normal", "normal", "fast", "normal"] }], ["drop", { kind: "health", at: { x: -13.4, y: 0, z: -1.4 } }]] },
        { id: "contract", when: { used: "contract" }, do: [["flag", "found:contract"], ["card", { id: "contract", icon: "📄", title: "story.card.contractTitle", lines: ["story.ch1.contract1", "story.ch1.contract2"] }]] },
        // the hold: each time it repeats, more of them -- by the west, by the entrance; the office's door bangs, and
        // gives; a window; the Screamers
        // (never more than six standing: a group comes short when the last one is still there)
        { id: "h0", after: "x:hold", when: { time: 12 }, do: [["spawn", { id: "g0b", at: "corr1East", count: 1, kinds: ["fast"], max: 6 }]] },
        { id: "h1", after: "x:hold", when: { heldN: ["office", 1] }, do: [["spawn", { id: "g1", at: "corr1East", count: 2, kinds: ["normal"], max: 6 }], ["spawn", { id: "g1b", at: "corr1West", count: 1, kinds: ["normal"], max: 6 }]] },
        { id: "h1b", after: "on:h1", when: { time: 10 }, do: [["spawn", { id: "g1c", at: "corr1West", count: 1, kinds: ["fast"], max: 6 }]] },
        { id: "h1c", after: "on:h1", when: { time: 15 }, do: [["thud", { at: { x: -1.5, y: 0, z: 2.5 }, n: 5 }]] },
        { id: "h2", after: "x:hold", when: { heldN: ["office", 2] }, do: [["door", { id: "DADMIN", open: true }], ["sound", "kick"], ["sys", { key: "story.ch1.sys.screamer", glitch: true }], ["hint", { key: "story.hint.screamer", sec: 8 }],
          ["spawn", { id: "g2", at: "corr1East", count: 2, kinds: ["screamer", "normal"], max: 6 }], ["spawn", { id: "g2b", at: "corr1West", count: 1, kinds: ["normal"], max: 6 }]] },
        { id: "h2b", after: "on:h2", when: { time: 11 }, do: [["spawn", { id: "g2c", at: "corr1East", count: 1, kinds: ["fast"], max: 6 }]] },
        { id: "h3", after: "x:hold", when: { heldN: ["office", 3] }, do: [["if", { when: { zone: "adminIn" },
          do: [["glass", { at: { x: -12.5, y: 1.6, z: 9 }, dir: { x: 0, z: -1 } }], ["spawn", { id: "g3", at: "prWindow", count: 2, kinds: ["normal"], max: 6 }]],
          else: [["glass", { at: { x: -2.0, y: 1.6, z: 9 }, dir: { x: 0, z: -1 } }], ["spawn", { id: "g3", at: "adminWindow", count: 2, kinds: ["normal"], max: 6 }]] }],
          ["spawn", { id: "g3b", at: "corr1West", count: 1, kinds: ["fast"], max: 6 }], ["drop", { kind: "ammo", at: { x: -9.6, y: 0, z: 7.2 } }], ["drop", { kind: "health", at: { x: -6.2, y: 0, z: 7.4 } }]] },
        { id: "h3b", after: "on:h3", when: { time: 11 }, do: [["spawn", { id: "g3c", at: "corr1East", count: 1, kinds: ["normal"], max: 6 }]] },
        { id: "h4", after: "x:hold", when: { heldN: ["office", 4] }, do: [["spawn", { id: "g4", at: "corr1West", count: 2, kinds: ["screamer", "normal"], max: 6 }], ["spawn", { id: "g4b", at: "corr1East", count: 1, kinds: ["fast"], max: 6 }]] },
        { id: "h4b", after: "on:h4", when: { time: 9 }, do: [["spawn", { id: "g4c", at: "corr1West", count: 1, kinds: ["normal"], max: 6 }]] },
        // away from them while it is held
        { id: "away", after: "x:hold", when: { all: [{ not: { zone: "office" } }, { not: { flag: "x:held" } }] }, do: [["hint", "story.hint.stayMin"]] },
      ] },
    { id: "s7", title: "story.ch1.s7", objective: "story.ch1.s7.obj", start: { x: 4.5, y: 0, z: 6, yaw: Math.PI }, clock: "17:45", light: "sunset",
      doors: { ENTRANCE: true },        // (round 8: 1-5 shuts the front doors -- the crowd is outside)
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
