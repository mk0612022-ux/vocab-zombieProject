// ===================================================================
// CONFIG: every balance number in one file
// -------------------------------------------------------------------
// Health, time, damage, cooldowns, prices, waves: change a number here and
// that is all -- the code only reads them. Loaded right after js/strings.js,
// before any other script.
//
//   G.CONFIG            the game's knobs, by system (player, quiz, bosses,
//                       abilities, the third floor, the checkpoint, the HUD)
//   G.LEVELS            the three levels (waves, difficulty, spawn pace)
//   G.WAVE_TABLE        the twenty waves (G.WAVE_COUNT, G.BOSS_EVERY)
//   G.ECONOMY           what a wave and a boss pay, price scales
//   G.SHOP_ITEMS        the shop's goods and prices
//   G.WEAPON_DEFS       every gun (damage, fire rate, magazine, reload, price)
//   G.MELEE_DEF         the knife
//   G.ZOMBIE_TYPES      zombie health, speed and bite damage
//   G.PERKS             the perks, per level
//   G.LEVEL_OBJECTIVES  what each level asks for
//   G.ABILITIES         the twenty abilities (cooldown, duration)
// ===================================================================
window.G = window.G || {};

G.CONFIG = {
  // ---------------- the player ----------------
  player: {
    maxHp: 450,
    walkSpeed: 3.2, sprintSpeed: 5.2,       // metres a second, before the gun's weight class
    staminaDrain: 22, staminaRegen: 14,     // stamina (of 100) a second
    jumpSpeed: 4.2,
    wrongKillDamage: 22,                    // shooting a zombie with the wrong word
    healthPickup: 94,                       // a red health box
    // health comes back by itself once nothing has taken any for regenDelay
    // seconds: regenHp every regenEvery seconds (a bite, a trap, a wrong
    // answer, a boss -- any loss at all starts the wait again)
    regenDelay: 12, regenHp: 1, regenEvery: 2,
  },

  // ---------------- the end-of-wave quiz (new series, round 1, A) ----------------
  quiz: {
    questions: 6,            // asked after every wave, from that wave's own words
    passCorrect: 4,          // right answers needed to open the shop
    maxMistakes: 2,          // (so a third mistake fails it)
    seconds: 15,             // per question; running out counts as a mistake
    feedback: 1.4,           // seconds the right answer stays lit before the next
    minWordsPerWave: 6,      // every wave spawns at least this many different words
    // (vocabulary series, round 3, H5) the eight kinds of question: extra
    // seconds for the ones with more to read or to write (quiz, boss, locks)
    extraSeconds: { def2word: 4, cloze: 6, colloc: 3, paraphrase: 6, listen: 2, spell: 12 },
    wrongFeedback: 8,        // a wrong answer stays up longer (or until Next): the right word, a sentence, a collocation
    // how often each kind is asked, by the word's box: 1-2 mostly the first
    // three of H5 (Thai -> English, English -> Thai, Listening), from box 3
    // more of Definition, Cloze, Collocation, Paraphrase and Spelling
    weights: {
      low:  { th2en: 3, en2th: 3, listen: 2, def2word: 0.6, cloze: 0.6, colloc: 0.3, paraphrase: 0.3, spell: 0.4 },
      high: { th2en: 0.8, en2th: 0.8, listen: 0.8, def2word: 2, cloze: 2, colloc: 1.5, paraphrase: 1.5, spell: 2 },
    },
  },

  // ---------------- bosses (new series, round 1, C) ----------------
  boss: {
    // A boss's health comes from the wave it arrives on, not from which boss
    // it is: every boss at wave 5 has the same. Sized from what a typical
    // player's guns do by then, for a fight of about 1.5-2 min at wave 5,
    // 2-2.5 at 10, 2.5-3 at 15 and 3-4 at 20 (see the round 1 report).
    hpByWave: { 5: 6000, 10: 11000, 15: 22000, 20: 32000 },
    endlessGrowth: 0.25,                     // Endless, past wave 20: +25% of the wave-20 health a boss
    levelHpMult: { 1: 1, 2: 1.15, 3: 1.3 },  // the hospital and the bunker are harder
    questionSeconds: 10,                     // the hard word after its death
    // ammunition in the sealed arena: a box now and then, somewhere round the
    // arena, and one each time the boss falls past 75%, 50% and 25%
    arenaAmmo: { firstAfter: 12, every: [20, 30], maxLying: 3, dropsAt: [0.75, 0.5, 0.25], magsPerGun: 3 },
    // (round 2) and a health box as each new phase begins: a share of full health
    arenaHealth: { atPhase: true, heal: 0.3 },

    // (new series, round 2) Three phases by health: its old move down to
    // 66%, its first new one down to 33%, its second new one below that --
    // faster, sooner and chained into combos. Each phase starts with a roar
    // (phaseRoar seconds) and the body grows (phaseScale) and glows.
    phases: [0.66, 0.33],
    phaseRoar: 1.8,
    phaseScale: [1, 1.08, 1.16],
    comboGap: 0.7,                           // seconds between the moves of a phase-3 combo
    // Harder by wave. A pair is [at wave 5, at wave 20], on a straight line
    // in between (and past 20 stays at the wave-20 end): wave 5 is slower
    // with longer warnings, wave 20 the fastest.
    byWave: {
      warn: [1.35, 1],                       // every warning (the marks on the ground, a wind-up) x this
      speed: [0.88, 1.08],                   // walking speed x this
      cooldown: [1.2, 0.75],                 // the time between its moves x this
      damage: [0.75, 1.1],                   // what its moves take x this (the slam keeps its full blow)
      targetHp: [1, 1.8],                    // things to shoot down (orbs, eggs, pylons...) x this
    },
    phase3: { warn: 0.88, speed: 1.15, cooldown: 0.72 },
    maxMinions: 8,
    // Every move. Damage is a share of the player's full health (x byWave
    // damage); no single blow ever kills a player who had full health.
    // A pair [a, b] is by wave as above; "P3" is the phase-3 figure;
    // cdMult: how much longer than usual the boss waits after this move.
    moves: {
      swipe: { wind: 0.65, windP3: 0.5, damage: 0.13, push: 2.2, cd: 2.2, cdP3: 1.6 },
      // ---- phase 1: the old move of each ----
      slam: { radius: 3.8, crouch: 0.6, air: 1.4, damage: 0.55, push: 3, timesP3: 2 },
      laser: { charge: 1.3, time: 3, timeP3: 4, radius: 1.1, dps: 0.11 },
      roar: { radius: 8.5, wind: 1.4, time: 4, dps: 0.07, slow: 0.5 },
      summon: { wind: 1.5, count: [3, 4], fastShare: [0.25, 0.4], cdMult: 1.2 },
      charge: { aim: 1.3, speed: 17, width: 1.8, damage: 0.3, push: 3.5, stun: 2.3, vuln: 1.5, timesP3: 2 },
      roots: { rings: 3, ringsP3: 4, gap: 0.95, speed: 7, reach: 22, wind: 0.9, width: 0.9, damage: 0.14, hold: 1.0 },
      lightning: { radius: 2.3, first: [5, 6], warn: 1.45, secondAt: 1.9, secondWarn: 1.0, second: 3, damage: 0.24 },
      acid: { flasks: 3, flasksP3: 4, flight: 1.1, radius: 2.2, damage: 0.1, poolTime: 6, poolDps: 0.12 },
      vortex: { wind: 1.2, time: 4.0, timeP3: 5.0, reach: 20, reachHall: 13, core: 2.6, pull: 2.2, pullHall: 1.7, dps: 0.15 },
      clones: { copies: 2, copiesP3: 3, wind: 0.8, time: 7, throwEvery: 3.2, bladeSpeed: 8, bladeDamage: 0.04, breakAt: 0.05 },
      // ---- phase 2 and 3: two new moves each ----
      ward: { wind: 1.6, keepers: [3, 4], armor: 0.15, maxTime: [20, 17], stun: 3, vuln: 1.5 },
      graveyard: { tile: 4, grid: 5, warn: [1.6, 1.25], nextWarn: [1.4, 1.1], rounds: 2, roundsP3: 3, damage: 0.14 },
      orbs: { count: [3, 5], wind: 1.2, speed: [2.2, 2.9], turn: 2.5, life: 9, hitR: 0.75, blast: 1.4, damage: 0.1, hp: 1 },
      mirror: { wind: 1.0, reflect: [4, 3.5], open: [4, 2.5], weakMult: 2.5, reflectDamage: 0.02, reflectEvery: 0.3 },
      detention: { radius: 7, wind: [1.5, 1.1], close: [5, 3.6], gapDeg: 55, lineDamage: 0.05, trapped: 0.18, root: 1.2 },
      assembly: { radius: [5.5, 4.2], warn: [3.2, 2.3], burn: 1.8, dps: 0.14, secondRadius: 0.75, secondWarn: 0.8, near: 8, far: 12 },
      needles: { lanes: [3, 5], step: 0.21, wind: [1.2, 0.85], width: 0.5, reach: 24, speed: 26, damage: 0.07, slow: 0.55, slowTime: 2.5, volleys: [2, 3], gap: 1.0 },
      eggs: { count: [3, 4], flight: 1.0, hatch: [8, 6], hp: 40, near: 5, far: 9, cdMult: 1.7 },
      ball: { radius: 1.1, speed: [15, 19], bounces: [2, 3], warn: [1.0, 0.65], damage: 0.18, push: 3 },
      line: { speed: [7, 9.5], gapWidth: [5, 3.8], gaps: [2, 1], warn: [2.4, 1.7], damage: 0.2, push: 4, depth: 1.4, seg: 2 },
      bark: { wind: 1.2, time: [8, 10], armor: 0.3, open: [2.2, 1.5], closed: [2.4, 3.0], heartMult: 2.5, speed: 1.3 },
      overgrowth: { lines: [3, 5], wind: [1.5, 1.05], width: 1.0, reach: 18, stay: [6, 8], damage: 0.12, dps: 0.1, slow: 0.5 },
      pylons: { count: [3, 4], wind: 1.3, hp: 45, radius: 1.3, dropDamage: 0.1, on: [1.3, 1.8], off: [2.2, 1.4], flicker: [1.0, 0.65], life: 12, width: 0.6, damage: 0.12, cdMult: 1.3 },
      arcs: { shots: [3, 4], track: [0.7, 0.5], lock: [0.8, 0.6], gap: [0.8, 0.6], width: 0.7, damage: 0.1 },
      spray: { reach: 12, half: 0.42, sweep: 1.7, wind: [1.3, 0.9], time: [2.8, 2.0], dps: 0.14 },
      miasma: { radius: 3.0, speed: [2.0, 2.4], life: [7, 8], dps: 0.08, hp: 30, flight: 1.0, cdMult: 2.2 },
      blackout: { wind: 1.3, time: [7, 8], blinks: [2, 3], behind: 5, warn: [1.1, 0.75], reach: 5.2, damage: 0.16, dim: 0.12 },
      chains: { wind: [1.3, 1.0], width: 0.9, reach: 24, fly: 30, pull: 4.2, hold: 3.0, hp: 30, touchDps: 0.18 },
      choice: { copies: 4, wind: 1.0, time: [11, 8], wrongDamage: 0.08, stun: 2.5, vuln: 1.3 },
      stamp: { count: [3, 5], half: 1.7, warn: [1.25, 0.85], gap: [0.5, 0.35], damage: 0.2 },
    },
  },

  // ---------------- abilities (their cooldowns and durations: G.ABILITIES below) ----------------
  abilities: {
    max: 4, offer: 5,
    dash: { speed: 34, time: 0.18, safe: 0.3 },
    overdrive: { speedMult: 1.25 },
    vault: { up: 6.2, forward: 6.5 },
    rewind: { seconds: 4 },
    barrier: { damageTaken: 0.25 },
    smoke: { radius: 12 },
    decoy: { radius: 15, distance: 2.2 },
    patch: { heal: 0.35 },
    freeze: { range: 40, boss: 0.8 },
    shockwave: { radius: 6, push: 4, daze: 1.0, boss: 0.4 },
    timewarp: { radius: 12, speed: 0.33, boss: 0.8 },
    glue: { radius: 3.6, speed: 0.2, boss: 0.75, range: 22 },
    flashbang: { range: 15 },
    well: { radius: 10, pull: 3.2, range: 12 },
    magnet: { radius: 30 },
    resupply: { spareMags: 1 },
  },

  // ---------------- the school's third floor ----------------
  floor3: { correctKills: 50, notes: 3, bossWave: 5, words: 3, wordSeconds: 15, lockout: 30 },

  // ---------------- the checkpoint ----------------
  checkpoint: { afterWave: 10 },

  // ---------------- the edge of the map (visual series, round 3, L2-L3) ----------------
  // The school's fence: its sealed line reaches fenceWall metres out into the
  // forest; no move takes a step longer than moveStep (a Dash covers ~6 m in a
  // fifth of a second); a zombie, a boss's helper or a drop is never placed
  // closer to the fence than spawnMargin / dropMargin (past the play area's
  // own edge, which is already a body's width in from the fence's sealed
  // line). js/world.js, js/game.js
  world: { fenceWall: 2.5, moveStep: 0.25, spawnMargin: 0.2, dropMargin: 1.0 },

  // ---------------- odd zombies (newer list, round 3, I2) ----------------
  // How often a zombie is one of the odd ones, and which kind (relative
  // weights): a deformed face, its own head carried in its hand (the head
  // hitbox goes with it), one arm too long, one arm too big. A crawler can
  // only have the face; a boss is never odd. js/entities.js
  // (overhaul, round 4: a head carried and a long arm are kinds of their own
  // now -- the Headless and the Reacher -- so only a Shambler is odd, and
  // only so: a torn face, or one swollen arm)
  zombieLooks: { oddChance: 0.24, odd: { deformed: 3, bigArm: 1.6 } },

  // ---------------- the ten kinds of zombie (overhaul, round 4) ----------------
  // js/zombiefactory.js (looks), js/zombieanim.js (how they move),
  // js/zombieai.js (what they do); docs/overhaul/zombie-concepts.md
  zombies: {
    // the wave a kind first comes in; before it, none
    first: { fast: 3, crawler: 4, bloater: 6, screamer: 7, ironclad: 8, runt: 9, headless: 11, reacher: 12, abomination: 13 },
    // its share of a wave from then: [at its first wave, at full, the wave it is full]
    // (the Sprinter's and the Crawler's are G.WAVE_TABLE's own columns)
    share: {
      bloater: [0.05, 0.08, 14], screamer: [0.04, 0.06, 15], ironclad: [0.06, 0.1, 16], runt: [0.05, 0.08, 15],
      headless: [0.05, 0.07, 17], reacher: [0.05, 0.07, 18], abomination: [0.03, 0.05, 20],
    },
    // never more than this many of a kind at once
    maxAlive: { abomination: 1, screamer: 2, bloater: 3, reacher: 3, ironclad: 4 },
    // at most this many zombies at once, by graphics level (a wave can ask for 14)
    aliveCap: { vlow: 8, low: 10, medium: 12, high: 14, vhigh: 16 },
    // no two alive look alike in every part, and a wave's zombies wear at
    // least this many different outfits (as many as the level has) before any repeats
    variety: 3,
    // the bite: a wind-up the player can read, then the strike -- if still in
    // reach (+ grace); `cooldown` between strikes
    attack: { reach: 1.1, windup: 0.3, grace: 0.35, cooldown: 1.0 },
    // per kind: a longer reach, a longer wind-up
    reach: { reacher: 2.6, abomination: 1.5, runt: 0.9 },
    windup: { reacher: 0.62, abomination: 0.45, bloater: 0.42, runt: 0.2, fast: 0.22 },
    // the Bloater: killed, it swells for `fuse` seconds, then bursts -- the
    // player inside `radius` takes up to `damage` (less further out), the
    // zombies round it are thrown back and stagger, nobody dies of it
    bloater: { fuse: [0.8, 1.2], radius: 3, damage: 70, push: 2.4, stagger: 0.9 },
    // the Screamer: within `range` of the player it rears up for `windup` s
    // and shrieks -- every zombie within `radius` comes on `boost` times as
    // fast for `boostTime` s, and up to `call` more of the wave's own come in
    // at once (never past the wave's count); `cooldown` between shrieks.
    // Killed while rearing up, the shriek never comes.
    screamer: { range: [5, 16], windup: 1.0, radius: 20, boost: 1.4, boostTime: 5, cooldown: 14, call: 2, firstDelay: 3 },
    // the Ironclad: its helmet stops a head shot (each does `helmetDamage` of
    // a body hit) until `helmetHits` have knocked it off; its vest takes a
    // share off every body hit
    ironclad: { helmetHits: 3, helmetDamage: 0.25, vest: 0.7 },
    // a hit that does not kill: light (a flinch), medium (it staggers back),
    // heavy (it goes down and gets up) -- by the share of its hit points one
    // hit took; it can only be knocked down once every `heavyCooldown` s
    hit: { medium: 0.18, heavy: 0.45, heavyCooldown: 4, staggerTime: 0.45, staggerBack: 0.35, downTime: 1.4 },
    // the Sprinter and the Runt lose their footing now and then
    stumble: { chance: 0.1, every: 2, time: 0.55 },
    // how often a zombie's pose is worked out: every frame within `full` m of
    // the player, every 2nd frame to `half`, every 4th beyond; off screen not at all
    lod: { full: 15, half: 30 },
  },

  // ---------------- touch and HUD settings (their limits) ----------------
  touch: { lookDrag: 2.2 },                  // pixels of drag -> turn (x the player's sensitivity)
  hud: { minScale: 0.5, maxScale: 1.5 },

  // ---------------- learning (vocabulary series, round 2: js/srs.js, js/learnmodes.js) ----------------
  srs: {
    intervals: [1, 3, 7, 14, 30],   // days until the next review once a word is in box 1..5
    masteredEvery: 60,              // a mastered word comes back every 60 days
    recognitionMaxBox: 3,           // right answers that only need recognising (Classic) go no higher
    // (vocabulary series C5) the first box of a word the old statistics knew:
    // accuracy at or above `high` -> box 3, at or above `mid` -> box 2, else 1
    fromStats: { high: 0.85, mid: 0.6 },
  },
  waveWords: {
    maxNew: 4,                      // new words a wave may bring (more only while a wave would have fewer than quiz.minWordsPerWave)
    share: 0.6,                     // different words in a wave: this share of its zombies...
    max: 14,                        // ...at most this many (and never fewer than quiz.minWordsPerWave)
    learningShare: 0.35,            // of those, words still being learnt (boxes 1-2), after the due ones
  },
  // Adaptive: the clue and answer a word gets, by its box (one of the list,
  // the same all day for that word; js/learnmodes.js). "clue+answer".
  adaptive: {
    byBox: [
      ["thai+shoot"],                                                    // New
      ["thai+shoot"],                                                    // box 1
      ["thai+shoot", "definition+shoot"],                                // box 2
      ["definition+shoot", "cloze+shoot", "thai+spell"],                 // box 3
      ["thai+spell", "audio+spell", "definition+shoot", "cloze+shoot"],  // box 4
      ["thai+spell", "audio+spell", "definition+spell", "cloze+shoot"],  // box 5
      ["audio+spell", "definition+spell", "thai+spell", "cloze+shoot"],  // Mastered
    ],
  },
  // (vocabulary series, round 3) the English clues and the spoken word
  clues: {
    thaiUpToBox: 2,                 // a Definition clue shows the Thai too while the word is in box 1-2 (Settings can force it on or off)
    clozeFamily: 2,                 // Context: look-alikes from the word's own family (other forms) on the field
    synonymMaxLength: 14,           // the one-word synonym over a zombie's head in Definition + Spell
  },
  // (vocabulary series, round 4, J3) the learning achievements
  achievements: {
    mastered: 100,                  // "100 Words Mastered"
    reviewStreak: 7,                // "7-Day Streak" (Daily Review)
    spellingBee: 50,                // "Spelling Bee": right spellings in a row
    perfectDictation: 6,            // "Perfect Dictation Wave": at least this many words, none missed
  },
  // (round 4, J1) Practice Mode: words a session, and what "often wrong" means
  practice: {
    words: 15,                      // questions a session at most
    wrongMin: 2,                    // missed at least this many times...
    wrongShare: 0.25,               // ...and at least this share of its answers
  },
  // (round 4) the Progress page: the most-missed list, the activity chart
  progress: { topMissed: 10, days: 30 },
  // ---------------- new series, round 1 ----------------
  // C: updates (js/updater.js)
  update: {
    checkMinutes: 5,                // in the lobby, look for a new version this often
    offlineRetrySeconds: 60,        // ...and this often while offline
    timeout: 8000,                  // ms to wait for version.json before calling it offline
    minBootMs: 1000,                // (round 2, D) the Loading screen stays at least this long (no flash)
    bootWaitMs: 8000,               // ...and waits at most this long for a picture that does not come
    restartDelay: 1200,             // ms "Update complete - restarting" shows before the reload
    parallel: 4,                    // files downloaded at once
  },
  // (new series, round 2, E) the Start screen (js/start.js)
  start: {
    fadeMs: 500,                    // its fade into the lobby
  },
  // (new series, round 2, F) a controller's right stick (js/game.js); the
  // Settings slider multiplies the speed (G.save.settings.padSensitivity)
  pad: {
    look: 6,                        // look per frame at full tilt, before the setting
    deadzone: 0.15,                 // a stick this far off centre is still at rest
  },
  // (new series, round 2, E) the lobby's music, from the Start screen's tap on (js/audio.js menuMusic)
  menuMusic: {
    root: 55,                       // Hz: the drone's low A
    gain: 0.5,                      // the drone, on the music bus
    wind: 0.12,                     // the wind, on the ambient bus
    bells: [0, 3, 5, 7, 10],        // semitones: a minor pentatonic
    bellGain: 0.05,
    bellGap: [3.5, 8.5],            // seconds between bells
  },
  // B: aiming into a crowd (js/aim.js)
  aim: {
    hitboxPad: 1.06,                // a hitbox is this much bigger than the part it covers
    outline: 1.12,                  // the glow round the zombie under the crosshair (x its hitboxes)
    labelHover: 1.3,                // ...and its word, this much larger
    posScale: 0.46,                 // (new series, round 2, G) a word's part of speech after it, this share of its size
    pinyinScale: 0.4,               // (round 3, H4) the pinyin over a Chinese label, this share of the characters' size
    labelGapPx: 4,                  // between two words on screen
    labelUp: 16,                    // a word may move up this many of its heights to keep clear of the others...
    labelUpScreen: 0.6,             // ...or this share of the screen, whichever is more
    labelDown: -2.5,                // ...or down this many (a move down costs twice a move up)
    labelEase: 12,                  // how fast a word slides to its place (per second)
    leaderMin: 0.35,                // moved more than this (x its height): a line to its zombie
    wallCheck: 0.15,                // seconds between checks that a word is not behind a wall
    assistRange: 40,                // aim assist looks this far
    // touch screen and controller (Settings: Aim assist): cone = degrees
    // round the crosshair it reaches, pull = how fast (per second)
    assist: { low: { cone: 4, pull: 1.5 }, medium: { cone: 6, pull: 3 }, high: { cone: 9, pull: 5 } },
  },
  crowd: {
    gap: 0.75,                      // zombies keep at least this far apart (m)
    gapCrawler: 1.0,                // ...a crawler, which is long
    push: 6,                        // how fast they ease apart
    flank: 0.9,                     // each closes in up to this many radians round the player from where it is...
    flankFrom: 3,                   // ...when farther than this (m); nearer, straight in
    flankRamp: 6,                   // full turn from this far beyond flankFrom
    flankStep: 2,                   // the point it heads for is this much closer than it is
  },
  speech: {
    rate: 1,                        // "Normal"
    slowRate: 0.8,                  // "Slow" (x the normal rate)
    sameZombieGap: 2.5,             // Dictation: seconds before aiming at the same zombie again says its word again
  },
  distractors: {
    field: 1,                       // look-alike zombies on the field for a target in box 2 or higher
    choices: 2,                     // look-alike wrong answers in a question (the rest are random)
    fromBox: 2,                     // below this box (new words, box 1) only clearly different words are used
    nearSpelling: 2,                // "spelt nearly the same": at most this many letters apart
    clearAfter: 3,                  // right answers in a row with the look-alike there, and the pair is let go
  },
  spell: {
    zombieSpeed: 0.62,              // zombies answered by spelling walk at this share of their speed
    nearMiss: 2,                    // letters apart from a word on the field that still count as a misspelling of it
    decoyLetters: [2, 3],           // extra letters mixed into the tiles (touch and controller)
    hintPenalty: 0.3,               // each letter revealed takes this share off the kill's money and score
    feedbackSeconds: 2.6,           // how long a wrong spelling stays marked up
    reloadWrongShare: 0.5,          // Spell to Reload: a wrong answer loads half a magazine
  },
  study: {
    // Daily Review and the learning modes (js/study.js): short sessions
    dailyMax: 30,                   // words per Daily Review session (a Continue button if more are due)
    learnCards: 16,                 // words per learning-mode session
    // (round 4, K: tuned on a 30-word review played by a model player -- one
    // who needs 5 s a word was bitten 15 times at 5 / 2.4 s / 0.9, so half
    // its review counted wrong for being slow; now 3 times, and a 30-word
    // review takes 1.7-2.2 minutes)
    alive: 4,                       // zombies on the field at once
    aliveSpell: 3,                  // ...in a session answered only by spelling (typing takes longer)
    every: 3.2,                     // seconds between arrivals
    everySpell: 4,                  // ...in a session answered only by spelling
    speed: 0.55,                    // walking speed (x the zombie's own)
    retryWrong: true,               // a word missed comes back once at the end (it does not count again)
    score: { right: 30, perBox: 10, spell: 20 },
  },
  // ---------------- the weapon in the hands (overhaul, round 1) ----------------
  // G.WeaponSM (js/weaponsm.js) and its animation (js/viewmodel.js), in
  // seconds. Per weight class: light / medium / heavy / very_heavy (and the
  // knife). docs/overhaul/weapon-state-machine.md has the tables.
  weaponSM: {
    fireCancelsReload: true,        // a fresh trigger pull, rounds still in the magazine, before it seats: the reload stops and the gun fires
    sprintCancelsReload: false,     // breaking into a run goes on reloading (the hands keep working)
    tacticalScale: 0.85,            // a reload with rounds left (nothing to release) takes this share of the time
    commitGrace: 0.15,              // the magazine counts as seated this long after its moment at the latest, step or no step
    loopStopTail: 0.16,             // shell by shell, stopped early with a round chambered: back to the ready in this long
    sprintOut: { light: 0.10, medium: 0.18, heavy: 0.25, very_heavy: 0.30, melee: 0.06 },   // out of a run to the first shot
    aimIn: { light: 0.15, medium: 0.22, heavy: 0.30, very_heavy: 0.34, melee: 0.2 },        // hip to aimed, eased in and out
    aimOutShare: 0.8,               // ...and back down, as a share of that
    raise: 0.12,                    // a lowered gun brought up to fire
    lowerUse: 0.45,                 // how long the gun stays down after pressing Use
    inspect: { light: 2.0, medium: 2.2, heavy: 2.5, very_heavy: 2.7, melee: 1.6 },
    melee: { hit: 0.10, dur: 0.45 },   // the blade arrives this long into the swing (dur: when the knife has no fireRate)
    recoverPad: 0.06,               // Recovering lasts the time between shots and this much more
    queueWindow: 0.35,              // a pull while the gun cannot fire yet (out of a run, coming up) still fires within this
    // nothing stays in a state longer than it could: past these it is put right (and a warning shows with ?debug=1)
    watchdog: { firing: 0.1, recoverPad: 0.5, reloadScale: 1.5, reloadPad: 0.5, switchScale: 2, switchPad: 0.3, inspectPad: 0.5, meleePad: 0.3 },
    // the animation (js/viewmodel.js)
    flinch: 1,                      // how far a hit knocks the gun (x the Camera Shake setting)
    lowerPose: { y: -0.2, rx: -0.5, z: 0.06 },      // a lowered gun, from the hip carry
    recoilCap: { pos: 0.26, rot: 0.5 },             // automatic fire builds up recoil to this and no further
    recoilReturn: { pos: 16, rot: 11 },             // how fast it settles back (rotation a little slower: the follow-through)
    aspect: { min: 0.8, max: 1.15 },                // the hip carry moved in on a narrow screen (4:3) and out on a wide one (21:9), x of 16:9
  },
  // ---------------- the weapon's looks and effects (overhaul, round 2) ----------------
  // js/gunskin.js (the guns' surfaces), js/fx.js (flash, smoke, shells, impacts,
  // bullet holes), js/surface.js (what a round hit). Per graphics level:
  // vlow / low / medium / high / vhigh (= Very Low ... Ultra).
  fx: {
    gunSkin: {
      texel: 0.006,                 // metres a texel on a part (16 px tiles)
      // lum: the tile's brightness (x the part's own colour; 1.25 = unchanged), noise:
      // pixel to pixel; rough / metal: the surface; scratches, dust and worn edges
      // catch the light differently (lighter, smoother, more metal)
      surfaces: {
        matte: { lum: 1.2, noise: 0.08, rough: 0.55, metal: 0.65, scratches: 3, scratchLum: 0.14, scratchRough: 0.32, scratchMetal: 0.9, dust: 0.25, wear: 0.4, edgeLum: 0.12, edgeRough: 0.35, edgeMetal: 0.9 },
        worn: { lum: 1.2, noise: 0.12, rough: 0.42, metal: 0.8, scratches: 5, scratchLum: 0.18, scratchRough: 0.25, scratchMetal: 0.95, dust: 0.3, wear: 0.7, edgeLum: 0.2, edgeRough: 0.22, edgeMetal: 0.95 },
        bare: { lum: 1.25, noise: 0.09, rough: 0.3, metal: 0.92, scratches: 6, scratchLum: 0.14, scratchRough: 0.18, scratchMetal: 1, dust: 0.15, wear: 0.5, edgeLum: 0.12, edgeRough: 0.2, edgeMetal: 1 },
        polymer: { lum: 1.25, noise: 0.06, rough: 0.68, metal: 0.02, scratches: 2, scratchLum: 0.1, scratchRough: 0.5, scratchMetal: 0.1, dust: 0.35, wear: 0.35, edgeLum: 0.1, edgeRough: 0.45, edgeMetal: 0.45 },
        grip: { lum: 1.25, noise: 0.05, rough: 0.9, metal: 0, scratches: 0, scratchLum: 0, scratchRough: 0.9, scratchMetal: 0, dust: 0.2, wear: 0.15, edgeLum: 0.06, edgeRough: 0.8, edgeMetal: 0 },
      },
      aoReach: 0.004, aoStep: 0.17, aoMin: 0.6,     // where parts meet: darker by aoStep for each part within aoReach
      handReach: 0.055, handShade: 0.8,             // ...and under the hands
    },
    // the muzzle flash: a quick sprite at the muzzle (40-60 ms), its shape and
    // size by family, 4 variants turned at random; a light from the fixed
    // pool lights what is near (never a new light). Fast guns (over rpmFast)
    // flash their light at half strength. x the Muzzle Flash setting.
    flash: {
      ms: [40, 60], variants: 4, rpmFast: 600, fastLight: 0.5, minSprite: 0.2,
      light: { color: 0xffc86b, intensity: 3, distance: 5 },
      // light on: per graphics level, every n-th shot (0 = never)
      lightEvery: { vlow: 0, low: 2, medium: 1, high: 1, vhigh: 1 },
      family: {
        pistol: { w: 0.11, h: 0.11, color: 0xffd27a }, smg: { w: 0.13, h: 0.12, color: 0xffcf73 },
        rifle: { w: 0.15, h: 0.17, color: 0xffc766 }, lmg: { w: 0.17, h: 0.19, color: 0xffc35e },
        shotgun_pump: { w: 0.24, h: 0.15, color: 0xffb95a }, shotgun_semi: { w: 0.22, h: 0.14, color: 0xffbd5e },
        sniper_bolt: { w: 0.2, h: 0.2, color: 0xffc766 }, special: { w: 0.18, h: 0.18, color: 0xff9a4d },
        knife: { w: 0, h: 0, color: 0 },
      },
    },
    // smoke from the muzzle: a puff a shot (every n-th for a fast gun), rising and fading
    smoke: { life: 0.9, size: [0.1, 0.45], rise: 0.35, alpha: 0.32, everyFast: 3, centerFade: 0.14, color: 0xb8bcc2 },
    // brass: thrown out to the right, a pool of them, in game time
    shells: { pool: 32, life: 1.1, color: 0xd9b24a, off: ["vlow", "low"] },
    // the budget per graphics level: particles alive at once (all the
    // weapon's effects together) and bullet holes on the walls (0 = none)
    budget: {
      vlow: { particles: 60, decals: 0, decalLife: 0, smoke: false },
      low: { particles: 120, decals: 24, decalLife: 8, smoke: true },
      medium: { particles: 250, decals: 48, decalLife: 12, smoke: true },
      high: { particles: 500, decals: 96, decalLife: 18, smoke: true },
      vhigh: { particles: 900, decals: 160, decalLife: 25, smoke: true },
    },
    // what a round throws off each surface: n pieces, their colours, size, speed;
    // decal: the bullet hole's kind (null: none); a shotgun's pellets make at
    // most pelletDecals holes and their pieces are shared out
    impact: {
      pelletDecals: 3, maxDistance: 45, life: [0.35, 0.8], gravity: 9,
      surfaces: {
        concrete: { n: 6, colors: [0x8b8f94, 0x6f7378, 0xa9adb2], size: [0.015, 0.035], speed: 2.2, decal: "hole", dust: 0x9aa0a6 },
        tile: { n: 5, colors: [0xdfe3e6, 0xc3c9cd, 0x9aa3a8], size: [0.012, 0.03], speed: 2.4, decal: "crack", dust: 0xd8dde0 },
        wood: { n: 5, colors: [0x8a5a35, 0x6e4426, 0xb07a4b], size: [0.01, 0.05], speed: 2, decal: "splinter", dust: 0x9b7653 },
        metal: { n: 7, colors: [0xfff1b0, 0xffc861, 0xff9a3d], size: [0.008, 0.016], speed: 3.6, decal: "dent", spark: true },
        glass: { n: 6, colors: [0xcfe9ff, 0xa9d4f5, 0xffffff], size: [0.01, 0.03], speed: 2.6, decal: null },
        grass: { n: 4, colors: [0x5f8f3a, 0x4a7a2c, 0x7aa64a], size: [0.01, 0.04], speed: 1.6, decal: null },
        dirt: { n: 6, colors: [0x6b5236, 0x523f2a, 0x7d6448], size: [0.012, 0.035], speed: 1.8, decal: null, dust: 0x7d6448 },
        water: { n: 6, colors: [0x9ec7e8, 0xd6ecff, 0x7aa9cf], size: [0.01, 0.03], speed: 2.4, decal: null },
        flesh: { n: 4, colors: [0x7a1c1c, 0x5c1414, 0x8a2a2a], size: [0.012, 0.03], speed: 1.8, decal: null },
      },
    },
    decal: { size: [0.07, 0.11], fade: 0.4, offset: 0.004 },
  },
  // ---------------- the sound (overhaul, round 3) ----------------
  // js/audio.js (the mixer, the voices), js/acoustics.js (the rooms' reverb),
  // js/gunaudio.js (the guns, pre-rendered), js/data/soundbank.js (what each
  // event plays). Levels in dB are as the spec gives them.
  audio: {
    // the mix: what each bus is at 100% of its slider
    busGain: { music: 0.42, weapons: 0.9, sfx: 0.9, ambient: 0.55, ui: 0.8 },
    // the master: a gentle compressor, then a limiter so nothing clips (peak about -1 dBFS)
    compressor: { threshold: -14, knee: 12, ratio: 6, attack: 0.004, release: 0.2 },
    limiter: { threshold: -1.5, knee: 0, ratio: 20, attack: 0.001, release: 0.08 },
    // ...and after it a soft ceiling (a WaveShaper): the browser's compressors add
    // their own make-up gain, so the last word on the peak is this -- straight
    // up to `knee`, then bending to never pass `ceilingDb`
    ceilingDb: -1, ceilingKnee: 0.6,
    // the weapons bus: rumble below 45 Hz off, a touch less mud at 250 Hz, the top end tamed
    weaponsEQ: { highpass: 45, mudFreq: 250, mudGain: -2, shelfFreq: 9000, shelfGain: -3 },
    // a boss's warning, a cutscene, a question window: music and ambience step back
    duck: { music: -6, ambient: -4, attack: 0.1, release: 0.8 },
    pauseMusic: -6,                 // paused: the music this much quieter (the game's sounds stop)
    // voices playing at once, by kind; past it the least important (then the farthest, then the oldest) gives way
    limits: { weapons: 6, impact: 8, zombie: 6, steps: 6, ui: 4, ambient: 4, sfx: 10 },
    total: { vlow: 16, low: 20, medium: 24, high: 32, vhigh: 40 },
    // the guns: drawn once ahead (OfflineAudioContext), so a shot only picks a buffer
    gunVariants: { vlow: 2, low: 3, medium: 4, high: 6, vhigh: 6 },
    gunCache: 12,                   // guns kept rendered (the ones in hand and the last ones used)
    gunPitch: 0.03,                 // +- a shot's pitch (and length) around its variant
    gunGainDb: 1,                   // +- a shot's level
    familySpreadDb: 1.5,            // guns of one family are brought within this of their family's loudness
    lowAmmoShare: 0.25,             // the low-ammo tick, once, when the magazine falls to this share
    // spatial: HRTF for the nearest few on High and Ultra; occlusion: a wall in the way muffles
    hrtf: { vlow: 0, low: 0, medium: 0, high: 4, vhigh: 8 },
    hrtfRange: 9,
    occlusion: { vlow: [0, 0], low: [0, 0], medium: [4, 4], high: [8, 8], vhigh: [10, 12] },   // [checks a second, sources]
    occluded: { lowpass: 900, gainDb: -6, time: 0.2 },
    // the rooms (js/acoustics.js): procedural impulse responses, crossfaded A/B
    reverbMode: { vlow: "off", low: "delay", medium: "short", high: "full", vhigh: "full+" },
    shortMax: 1.2,                  // Medium: no impulse longer than this
    crossfade: 0.6,
    zones: {
      corridor: { rt60: 1.0, predelay: 0.012, bright: 0.5, wet: 0.36, early: 5, spacing: 0.018 },
      underground: { rt60: 1.5, predelay: 0.018, bright: 0.35, wet: 0.42, early: 6, spacing: 0.022 },
      room: { rt60: 0.5, predelay: 0.006, bright: 0.6, wet: 0.28, early: 3, spacing: 0.009 },
      hall: { rt60: 2.2, predelay: 0.025, bright: 0.3, wet: 0.44, early: 4, spacing: 0.024 },
      warehouse: { rt60: 2.8, predelay: 0.035, bright: 0.28, wet: 0.46, early: 4, spacing: 0.03 },
      outdoor: { rt60: 0.7, predelay: 0.06, bright: 0.3, wet: 0.13, early: 2, spacing: 0.14, sparse: true },
    },
    smallRoom: 200,                 // m2: a room up to this is a small one (a classroom is ~163), bigger a large interior
    distant: { delay: 0.32, lowpass: 900, gain: 0.18 },      // Ultra: the far echo of a shot out of doors and in big spaces
    // footsteps and the crowd
    zombieSteps: 3,                 // the nearest few zombies' own footsteps (the rest: the horde bed)
    stepRange: 12,
    horde: { range: 15, full: 10, gain: 0.32 },   // the bed's level at `full` zombies within range
    captions: { max: 3, life: 2.6, growlRange: 10, growlEvery: 4 },
  },
};

// ---------------- Level definitions ----------------
// names are "level.<id>" in js/strings.js, set on load by G.localizeData
// (new list, round 2: twenty waves each, a boss every fifth -- the curve is
// G.WAVE_TABLE and G.BOSS_EVERY below; `difficulty` makes the
// later levels harder)
G.LEVELS = [
  {
    id: 1, theme: "school", icon: "🏚️", wordsKey: "level1",
    waves: 20, difficulty: 1,
    spawnBaseInterval: 5.0, maxAliveZombies: 7,
  },
  {
    id: 2, theme: "hospital", icon: "🏥", wordsKey: "level2",
    waves: 20, difficulty: 1.35,
    spawnBaseInterval: 4.2, maxAliveZombies: 9,
  },
  {
    id: 3, theme: "bunker", icon: "🛡️", wordsKey: "level3",
    waves: 20, difficulty: 1.7,
    spawnBaseInterval: 3.4, maxAliveZombies: 11,
  },
];

// ---------------- Weapon definitions ----------------
// `color` = main body tone, `accent` = secondary panel/trim tone. Both stay
// within the weapon's rarity family (see G.RARITY) but differ per weapon so
// two guns of the same rarity still read as distinct pieces of hardware.
G.WEAPON_DEFS = {
  // Display names are in js/strings.js ("weapon.<id>"), set on load by
  // G.localizeData; nothing here or in a save refers to a gun by its name.
  // `recoil` (category E3) scales the per-shot kick: how far the model punches
  // back, how hard it tilts up, and how much the view itself is thrown.
  pistol: { id: "pistol", rarity: "common", damage: 14, fireRate: 320, magSize: 12,
    reloadTime: 1000, auto: false, recoil: 0.7, price: 0, color: 0x9fb9c9, accent: 0x2b3a42 },
  shotgun: { id: "shotgun", rarity: "common", damage: 9, pellets: 6, fireRate: 750, magSize: 6,
    reloadTime: 1600, auto: false, recoil: 1.7, price: 400, color: 0x7d97ab, accent: 0x35424c },
  smg: { id: "smg", rarity: "uncommon", damage: 10, fireRate: 110, magSize: 30,
    reloadTime: 1300, auto: true, recoil: 0.5, price: 900, color: 0x2fae54, accent: 0x1f3d2a },
  rifle: { id: "rifle", rarity: "uncommon", damage: 18, fireRate: 160, magSize: 25,
    reloadTime: 1500, auto: true, recoil: 0.75, price: 1200, color: 0x39c463, accent: 0x224a2e },
  lmg: { id: "lmg", rarity: "rare", damage: 15, fireRate: 90, magSize: 60,
    reloadTime: 2200, auto: true, recoil: 0.6, price: 2200, color: 0x2f6fd6, accent: 0x18325e },
  sniper: { id: "sniper", rarity: "rare", damage: 90, fireRate: 950, magSize: 5,
    reloadTime: 1800, auto: false, recoil: 2.2, price: 2400, color: 0x3b82f5, accent: 0x15234a },
  railgun: { id: "railgun", rarity: "epic", damage: 45, fireRate: 500, magSize: 8,
    reloadTime: 1700, auto: false, pierce: true, recoil: 1.5, price: 4200, color: 0xc23bef, accent: 0x3d1a4a },
  grenadelauncher: { id: "grenadelauncher", rarity: "epic", damage: 70, fireRate: 900, magSize: 4,
    reloadTime: 2000, auto: false, splash: true, splashRadius: 4.5, recoil: 2.4, price: 4600, color: 0xa63bd6, accent: 0x3a1a44 },
  golden_smg: { id: "golden_smg", rarity: "secret", damage: 55, fireRate: 70, magSize: 50,
    reloadTime: 1000, auto: true, recoil: 0.65, price: 9999, color: 0xffd43b, accent: 0xa87d1a, legendary: true },

  // Wall-mounted exclusives (category C3): one per level, bought with saved-up
  // money via the level's wall-mount display, never obtainable from the shop's
  // crate roll (`wallExclusive: true` keeps them out of openCrate's pool).
  // Each sits clearly above every epic-tier option's sustained DPS (railgun
  // ~90, grenade launcher ~78) while staying under the 1%-chance golden_smg
  // jackpot (~785), since these are guaranteed-buyable rather than RNG.
  // Pricing reasoning: a boss kill alone pays 500, and a full run's normal
  // kills + wave bonuses realistically net a disciplined player (one who
  // skips a few shop upgrades) something in the low thousands by the run's
  // end -- so price scales with how long/hard the level is (5/6/7 waves),
  // keeping each a real "save up for it" goal without being unreachable in
  // one normal playthrough.
  school_wall: { id: "school_wall", rarity: "secret", damage: 20, fireRate: 90, magSize: 45,
    reloadTime: 1500, auto: true, recoil: 0.7, price: 1800, color: 0xd4a017, accent: 0x5a3d0a, wallExclusive: true },
  hospital_wall: { id: "hospital_wall", rarity: "secret", damage: 22, pellets: 8, fireRate: 500, magSize: 10,
    reloadTime: 1800, auto: false, recoil: 1.9, price: 2400, color: 0xe8e8e0, accent: 0xd6423c, wallExclusive: true },
  bunker_wall: { id: "bunker_wall", rarity: "secret", damage: 140, fireRate: 750, magSize: 6,
    reloadTime: 2000, auto: false, recoil: 2.5, price: 3200, color: 0x4a5c3a, accent: 0x2a2a26, wallExclusive: true },

  // Eight more wall mounts for the rebuilt school -- four on each floor, each
  // in its own room. Ground-floor guns are affordable mid-run pickups; the
  // upstairs four sit behind the 2nd-floor unlock so they're priced as
  // end-of-run goals (a boss alone pays 500, a full run nets low thousands).
  hall_monitor: { id: "hall_monitor", rarity: "rare", damage: 24, fireRate: 110, magSize: 35,
    reloadTime: 1400, auto: true, recoil: 0.6, price: 1200, color: 0x4fa3d9, accent: 0x1d3f57, wallExclusive: true },
  detention_slug: { id: "detention_slug", rarity: "rare", damage: 18, pellets: 6, fireRate: 780, magSize: 8,
    reloadTime: 1900, auto: false, recoil: 1.8, price: 1600, color: 0xc96a2f, accent: 0x4a2611, wallExclusive: true },
  pop_quiz: { id: "pop_quiz", rarity: "epic", damage: 34, fireRate: 200, magSize: 24,
    reloadTime: 1600, auto: true, recoil: 0.9, price: 2000, color: 0x8ad94f, accent: 0x2f4a1a, wallExclusive: true },
  cafeteria_cleaver: { id: "cafeteria_cleaver", rarity: "epic", damage: 72, fireRate: 520, magSize: 8,
    reloadTime: 1700, auto: false, recoil: 1.6, price: 2300, color: 0xd94f7a, accent: 0x4d162c, wallExclusive: true },
  // The four upstairs guns cost 20% less since the category P playtest: the
  // upper floor opens around wave 3, and at the old prices ($2,800-4,200) a
  // new player could not afford one before the level was over.
  honor_roll: { id: "honor_roll", rarity: "epic", damage: 110, fireRate: 620, magSize: 10,
    reloadTime: 1800, auto: false, recoil: 1.7, price: 2250, color: 0xd9c04f, accent: 0x4d4211, wallExclusive: true },
  science_fair: { id: "science_fair", rarity: "secret", damage: 45, fireRate: 105, magSize: 40,
    reloadTime: 2000, auto: true, recoil: 0.8, price: 2550, color: 0x4fd9c0, accent: 0x134a40, wallExclusive: true },
  art_attack: { id: "art_attack", rarity: "secret", damage: 120, fireRate: 950, magSize: 5,
    reloadTime: 2300, auto: false, splash: true, splashRadius: 4.5, recoil: 2.3, price: 2900, color: 0xb84fd9, accent: 0x3d134a, wallExclusive: true },
  principals_verdict: { id: "principals_verdict", rarity: "secret", damage: 150, fireRate: 700, magSize: 6,
    reloadTime: 2000, auto: false, pierce: true, recoil: 2.0, price: 3350, color: 0xff6a3d, accent: 0x5c1f08, wallExclusive: true },

  // ---------------- Mystery box pool (category C2) ----------------
  // Fifteen guns that exist only inside the 1,000-a-pull mystery box
  // (`boxOnly` keeps them out of crate rolls and the shop). Each pull deals a
  // hand of 6 cards: exactly one "elite" and five "standard", so the elite
  // tier lands 1-in-6 no matter what. boxWeight then splits the odds INSIDE
  // each tier, always weighted against power -- the weakest standard gun is
  // over five times as likely as the strongest, and the level-ending Meteor
  // Detention is the rarest thing in the game at 1%.
  scrap_spitter: { id: "scrap_spitter", rarity: "common", damage: 11, fireRate: 85, magSize: 32,
    reloadTime: 1600, auto: true, recoil: 0.5, color: 0x8a8f7a, accent: 0x3d4036, boxOnly: true, boxTier: "standard", boxWeight: 16 },
  nail_driver: { id: "nail_driver", rarity: "common", damage: 16, fireRate: 150, magSize: 24,
    reloadTime: 1400, auto: true, recoil: 0.6, color: 0xd2a63c, accent: 0x54401a, boxOnly: true, boxTier: "standard", boxWeight: 15 },
  hall_sweeper: { id: "hall_sweeper", rarity: "common", damage: 12, pellets: 5, fireRate: 720, magSize: 6,
    reloadTime: 2000, auto: false, recoil: 1.6, color: 0x6f7d86, accent: 0x2f3940, boxOnly: true, boxTier: "standard", boxWeight: 13 },
  chalk_burster: { id: "chalk_burster", rarity: "uncommon", damage: 21, burst: 3, burstDelay: 55, fireRate: 340, magSize: 21,
    reloadTime: 1700, auto: false, recoil: 0.8, color: 0x58b5a0, accent: 0x224740, boxOnly: true, boxTier: "standard", boxWeight: 12 },
  detention_deuce: { id: "detention_deuce", rarity: "uncommon", damage: 19, burst: 2, burstDelay: 70, fireRate: 340, magSize: 16,
    reloadTime: 1200, auto: false, recoil: 0.7, color: 0x9c6bd6, accent: 0x3b2a52, boxOnly: true, boxTier: "standard", boxWeight: 11 },
  rust_repeater: { id: "rust_repeater", rarity: "uncommon", damage: 28, fireRate: 420, magSize: 10,
    reloadTime: 1500, auto: false, recoil: 1.0, color: 0xa2603a, accent: 0x40261a, boxOnly: true, boxTier: "standard", boxWeight: 10 },
  gym_grinder: { id: "gym_grinder", rarity: "rare", damage: 9, fireRate: 55, magSize: 60,
    reloadTime: 3000, auto: true, recoil: 0.45, color: 0x3f6fb5, accent: 0x1b2c47, boxOnly: true, boxTier: "standard", boxWeight: 9 },
  copper_coil: { id: "copper_coil", rarity: "rare", damage: 44, charge: { time: 0.85, mult: 2.6 }, fireRate: 900, magSize: 5,
    reloadTime: 1900, auto: false, recoil: 1.5, color: 0xc9723f, accent: 0x3f2a1b, boxOnly: true, boxTier: "standard", boxWeight: 7 },
  locker_lancer: { id: "locker_lancer", rarity: "rare", damage: 50, fireRate: 520, magSize: 12,
    reloadTime: 1800, auto: false, recoil: 1.3, color: 0x2f6fb0, accent: 0x14314f, boxOnly: true, boxTier: "standard", boxWeight: 4 },
  bus_bulldog: { id: "bus_bulldog", rarity: "rare", damage: 58, fireRate: 650, magSize: 6,
    reloadTime: 2100, auto: false, recoil: 1.8, color: 0xb0b6bd, accent: 0x3a2f2a, boxOnly: true, boxTier: "standard", boxWeight: 3 },
  thunder_chalk: { id: "thunder_chalk", rarity: "epic", damage: 72, charge: { time: 0.75, mult: 2.4 }, fireRate: 480, magSize: 18,
    reloadTime: 2000, auto: false, recoil: 1.1, color: 0x7fe6ff, accent: 0x1d4c63, boxOnly: true, boxTier: "elite", boxWeight: 32 },
  void_principal: { id: "void_principal", rarity: "epic", damage: 42, fireRate: 95, magSize: 40,
    reloadTime: 2100, auto: true, recoil: 0.9, color: 0x5b3fa8, accent: 0x211640, boxOnly: true, boxTier: "elite", boxWeight: 28 },
  prism_lance: { id: "prism_lance", rarity: "epic", damage: 95, fireRate: 480, magSize: 8,
    reloadTime: 1800, auto: false, pierce: true, recoil: 1.4, color: 0xef5fd0, accent: 0x4a1a42, boxOnly: true, boxTier: "elite", boxWeight: 20 },
  final_bell: { id: "final_bell", rarity: "secret", damage: 30, pellets: 8, fireRate: 420, magSize: 10,
    reloadTime: 2400, auto: true, recoil: 2.0, color: 0xffd43b, accent: 0x6b4a08, boxOnly: true, boxTier: "elite", boxWeight: 14 },
  meteor_detention: { id: "meteor_detention", rarity: "secret", damage: 165, fireRate: 1100, magSize: 4,
    reloadTime: 2600, auto: false, splash: true, splashRadius: 5, recoil: 2.6, color: 0xff6a2b, accent: 0x5c1f08, boxOnly: true, boxTier: "elite", boxWeight: 6 },
};

G.MYSTERY_BOX_COST = 1250;            // (round 2: was 1000, priced for twenty waves)
G.MYSTERY_CARD_COUNT = 6;
// One elite + five distinct standards, elite slot shuffled to a random index.

// ================= Per-level arsenals (categories H1 and N) =================
// Every weapon belongs to exactly one level. The only gun shared across all
// three is the starting pistol (level 0). Guns are separated by MECHANIC, not
// just by numbers -- each level gets the full spread of the eight firing
// behaviours the game supports:
//
//   semi        one shot per trigger pull
//   auto        holds down
//   pellets     shotgun spread, strong close and weak far
//   burst: n    n rounds per pull, burstDelay apart
//   charge      hold to wind up, damage scales with charge
//   pierce: n   passes through up to n zombies
//   splash      explodes for splashRadius
//   scope       aims down a real scope at that FOV
//
// ---------------- Level 2: the hospital (25 guns) ----------------
// Clean, clinical, sci-fi: white and mint hardware, glass, coils.
Object.assign(G.WEAPON_DEFS, {
  // -- shop / crate pool (5) --
  sterile_slug: { id: "sterile_slug", rarity: "common", damage: 10, pellets: 6, spread: 0.075, fireRate: 720, magSize: 6,
    reloadTime: 1600, auto: false, recoil: 1.7, price: 420, color: 0xe4ece8, accent: 0x5f736c, level: 2, archetype: "shotgun" },
  rebound_pistol: { id: "rebound_pistol", rarity: "common", damage: 20, fireRate: 290, magSize: 14,
    reloadTime: 1000, auto: false, recoil: 0.7, price: 300, color: 0xbcd6cf, accent: 0x36514a, level: 2, archetype: "pistol" },
  scalpel_smg: { id: "scalpel_smg", rarity: "uncommon", damage: 12, fireRate: 100, magSize: 32,
    reloadTime: 1300, auto: true, recoil: 0.5, price: 920, color: 0x6fd9bd, accent: 0x1f4a40, level: 2, archetype: "smg" },
  triage_carbine: { id: "triage_carbine", rarity: "uncommon", damage: 20, burst: 3, burstDelay: 60, fireRate: 340, magSize: 24,
    reloadTime: 1400, auto: false, recoil: 0.8, price: 1250, color: 0x4fbfd9, accent: 0x18414f, level: 2, archetype: "rifle" },
  crash_cart: { id: "crash_cart", rarity: "epic", damage: 72, fireRate: 900, magSize: 4,
    reloadTime: 2000, auto: false, splash: true, splashRadius: 4.5, recoil: 2.4, price: 4400, color: 0xd94f6a, accent: 0x4d1522, level: 2, archetype: "launcher" },

  // -- wall mounts (8) --
  iv_repeater: { id: "iv_repeater", rarity: "rare", damage: 22, fireRate: 95, magSize: 40,
    reloadTime: 1500, auto: true, recoil: 0.55, price: 1300, color: 0x8fd6ff, accent: 0x1d3f57, level: 2, archetype: "smg", wallExclusive: true },
  bone_saw: { id: "bone_saw", rarity: "rare", damage: 16, pellets: 7, spread: 0.05, fireRate: 700, magSize: 8,
    reloadTime: 1800, auto: false, recoil: 1.8, price: 1700, color: 0xd9d2c4, accent: 0x4a4436, level: 2, archetype: "shotgun", wallExclusive: true },
  morphine_mist: { id: "morphine_mist", rarity: "epic", damage: 26, burst: 4, burstDelay: 55, fireRate: 420, magSize: 28,
    reloadTime: 1600, auto: false, recoil: 0.9, price: 2100, color: 0xb48fd9, accent: 0x3a2352, level: 2, archetype: "rifle", wallExclusive: true },
  quarantine_lance: { id: "quarantine_lance", rarity: "epic", damage: 62, pierce: 4, fireRate: 520, magSize: 10,
    reloadTime: 1800, auto: false, recoil: 1.4, price: 2500, color: 0x4fd9a8, accent: 0x134a36, level: 2, archetype: "beam", wallExclusive: true },
  autoclave: { id: "autoclave", rarity: "epic", damage: 80, fireRate: 950, magSize: 5,
    reloadTime: 2200, auto: false, splash: true, splashRadius: 4.0, recoil: 2.2, price: 2900, color: 0xff9a5b, accent: 0x5c2c0f, level: 2, archetype: "launcher", wallExclusive: true },
  defib_driver: { id: "defib_driver", rarity: "secret", damage: 46, charge: { time: 1.0, mult: 3.2 }, fireRate: 500, magSize: 12,
    reloadTime: 2000, auto: false, recoil: 1.3, price: 3300, color: 0xffe14d, accent: 0x5c4a08, level: 2, archetype: "energy", wallExclusive: true },
  vital_sign: { id: "vital_sign", rarity: "secret", damage: 165, scope: 26, fireRate: 1000, magSize: 5,
    reloadTime: 1900, auto: false, recoil: 2.3, price: 3900, color: 0x7dffc0, accent: 0x14493a, level: 2, archetype: "sniper", wallExclusive: true },
  code_blue: { id: "code_blue", rarity: "secret", damage: 50, fireRate: 90, magSize: 45,
    reloadTime: 2000, auto: true, recoil: 0.8, price: 4400, color: 0x5b9bff, accent: 0x142a52, level: 2, archetype: "lmg", wallExclusive: true },

  // -- mystery box (12) --
  gauze_gun: { id: "gauze_gun", rarity: "common", damage: 12, fireRate: 90, magSize: 30,
    reloadTime: 1500, auto: true, recoil: 0.45, color: 0xe8e4d8, accent: 0x53504a, level: 2, archetype: "smg", boxOnly: true, boxTier: "standard", boxWeight: 16 },
  syringe_spitter: { id: "syringe_spitter", rarity: "common", damage: 18, fireRate: 160, magSize: 20,
    reloadTime: 1300, auto: false, recoil: 0.5, color: 0xa8d6e8, accent: 0x2d4650, level: 2, archetype: "pistol", boxOnly: true, boxTier: "standard", boxWeight: 15 },
  plaster_popper: { id: "plaster_popper", rarity: "common", damage: 11, pellets: 5, spread: 0.09, fireRate: 740, magSize: 6,
    reloadTime: 1900, auto: false, recoil: 1.6, color: 0xcfc6b4, accent: 0x453f34, level: 2, archetype: "shotgun", boxOnly: true, boxTier: "standard", boxWeight: 13 },
  oxygen_burst: { id: "oxygen_burst", rarity: "uncommon", damage: 22, burst: 3, burstDelay: 60, fireRate: 360, magSize: 21,
    reloadTime: 1600, auto: false, recoil: 0.8, color: 0x5fd6e8, accent: 0x1a4650, level: 2, archetype: "rifle", boxOnly: true, boxTier: "standard", boxWeight: 12 },
  reflex_hammer: { id: "reflex_hammer", rarity: "uncommon", damage: 34, fireRate: 430, magSize: 10,
    reloadTime: 1400, auto: false, recoil: 1.1, color: 0xd98f4f, accent: 0x4d2f15, level: 2, archetype: "pistol", boxOnly: true, boxTier: "standard", boxWeight: 11 },
  dialysis_drum: { id: "dialysis_drum", rarity: "uncommon", damage: 14, fireRate: 70, magSize: 55,
    reloadTime: 2600, auto: true, recoil: 0.5, color: 0x6f9c8f, accent: 0x243a34, level: 2, archetype: "lmg", boxOnly: true, boxTier: "standard", boxWeight: 10 },
  x_ray_beam: { id: "x_ray_beam", rarity: "rare", damage: 52, pierce: 3, fireRate: 560, magSize: 9,
    reloadTime: 1800, auto: false, recoil: 1.2, color: 0xb9a8ff, accent: 0x2f2452, level: 2, archetype: "beam", boxOnly: true, boxTier: "standard", boxWeight: 8 },
  anesthetic_arc: { id: "anesthetic_arc", rarity: "rare", damage: 40, charge: { time: 0.9, mult: 2.8 }, fireRate: 700, magSize: 8,
    reloadTime: 1900, auto: false, recoil: 1.3, color: 0x8f6fd9, accent: 0x2a1c4d, level: 2, archetype: "energy", boxOnly: true, boxTier: "standard", boxWeight: 6 },
  cardiac_coil: { id: "cardiac_coil", rarity: "rare", damage: 110, scope: 30, fireRate: 950, magSize: 5,
    reloadTime: 1800, auto: false, recoil: 2.1, color: 0xff6b8f, accent: 0x50182c, level: 2, archetype: "sniper", boxOnly: true, boxTier: "standard", boxWeight: 4 },
  plague_thrower: { id: "plague_thrower", rarity: "epic", damage: 88, fireRate: 700, magSize: 8,
    reloadTime: 2100, auto: false, splash: true, splashRadius: 4.2, recoil: 1.9, color: 0x9cd94f, accent: 0x2f4a15, level: 2, archetype: "launcher", boxOnly: true, boxTier: "elite", boxWeight: 34 },
  gene_splicer: { id: "gene_splicer", rarity: "epic", damage: 70, pierce: 5, charge: { time: 0.7, mult: 2.2 }, fireRate: 640, magSize: 10,
    reloadTime: 2000, auto: false, recoil: 1.5, color: 0xef5fd0, accent: 0x4a1a42, level: 2, archetype: "beam", boxOnly: true, boxTier: "elite", boxWeight: 26 },
  flatline: { id: "flatline", rarity: "secret", damage: 240, scope: 22, pierce: 6, fireRate: 1200, magSize: 3,
    reloadTime: 2400, auto: false, recoil: 2.7, color: 0xffd43b, accent: 0x5c4608, level: 2, archetype: "sniper", boxOnly: true, boxTier: "elite", boxWeight: 8 },
});

// ---------------- Level 3: the bunker (25 guns) ----------------
// Military and industrial: welded steel, olive drab, rust, reactor orange.
Object.assign(G.WEAPON_DEFS, {
  // -- shop / crate pool (5) --
  rebar_repeater: { id: "rebar_repeater", rarity: "common", damage: 22, fireRate: 300, magSize: 14,
    reloadTime: 1100, auto: false, recoil: 0.8, price: 520, color: 0x9a8f78, accent: 0x3a352a, level: 3, archetype: "pistol" },
  breach_gauge: { id: "breach_gauge", rarity: "common", damage: 11, pellets: 7, spread: 0.085, fireRate: 780, magSize: 5,
    reloadTime: 1700, auto: false, recoil: 1.9, price: 470, color: 0x7a6a4a, accent: 0x2f281c, level: 3, archetype: "shotgun" },
  scrap_auto: { id: "scrap_auto", rarity: "uncommon", damage: 13, fireRate: 95, magSize: 35,
    reloadTime: 1400, auto: true, recoil: 0.55, price: 980, color: 0x6f7a5a, accent: 0x2a2f1f, level: 3, archetype: "smg" },
  service_rifle: { id: "service_rifle", rarity: "uncommon", damage: 24, burst: 3, burstDelay: 55, fireRate: 330, magSize: 30,
    reloadTime: 1500, auto: false, recoil: 0.85, price: 1350, color: 0x5a6b45, accent: 0x222a1a, level: 3, archetype: "rifle" },
  pipe_mortar: { id: "pipe_mortar", rarity: "epic", damage: 84, fireRate: 950, magSize: 4,
    reloadTime: 2100, auto: false, splash: true, splashRadius: 5.0, recoil: 2.5, price: 4800, color: 0xb5651f, accent: 0x3f2109, level: 3, archetype: "launcher" },

  // -- wall mounts (8) --
  vent_ripper: { id: "vent_ripper", rarity: "rare", damage: 24, fireRate: 85, magSize: 45,
    reloadTime: 1700, auto: true, recoil: 0.6, price: 1400, color: 0x8a9aa5, accent: 0x2f3940, level: 3, archetype: "lmg", wallExclusive: true },
  bolt_thrower: { id: "bolt_thrower", rarity: "rare", damage: 58, pierce: 3, fireRate: 560, magSize: 8,
    reloadTime: 1700, auto: false, recoil: 1.4, price: 1800, color: 0xc9923f, accent: 0x453213, level: 3, archetype: "beam", wallExclusive: true },
  siege_slug: { id: "siege_slug", rarity: "epic", damage: 20, pellets: 8, spread: 0.055, fireRate: 820, magSize: 6,
    reloadTime: 2000, auto: false, recoil: 2.1, price: 2200, color: 0x6b7f8a, accent: 0x263036, level: 3, archetype: "shotgun", wallExclusive: true },
  drum_hammer: { id: "drum_hammer", rarity: "rare", damage: 18, fireRate: 65, magSize: 70,
    reloadTime: 2800, auto: true, recoil: 0.5, price: 2000, color: 0x4f6b8a, accent: 0x1b2a3a, level: 3, archetype: "lmg", wallExclusive: true },
  capacitor_lance: { id: "capacitor_lance", rarity: "epic", damage: 52, charge: { time: 1.0, mult: 3.0 }, fireRate: 640, magSize: 9,
    reloadTime: 1900, auto: false, recoil: 1.5, price: 2600, color: 0x5fd6ff, accent: 0x153f52, level: 3, archetype: "energy", wallExclusive: true },
  thermite_tube: { id: "thermite_tube", rarity: "epic", damage: 95, fireRate: 1000, magSize: 4,
    reloadTime: 2300, auto: false, splash: true, splashRadius: 4.6, recoil: 2.4, price: 3000, color: 0xff7a3d, accent: 0x54220c, level: 3, archetype: "launcher", wallExclusive: true },
  overwatch: { id: "overwatch", rarity: "secret", damage: 200, scope: 24, fireRate: 1050, magSize: 4,
    reloadTime: 2000, auto: false, recoil: 2.5, price: 4000, color: 0x3f5a3a, accent: 0x18261a, level: 3, archetype: "sniper", wallExclusive: true },
  warhead: { id: "warhead", rarity: "secret", damage: 220, fireRate: 1400, magSize: 2,
    reloadTime: 2800, auto: false, splash: true, splashRadius: 6.5, recoil: 2.9, price: 5200, color: 0xff4d4d, accent: 0x5c0f0f, level: 3, archetype: "cannon", wallExclusive: true },

  // -- mystery box (12) --
  nut_cracker: { id: "nut_cracker", rarity: "common", damage: 20, fireRate: 280, magSize: 12,
    reloadTime: 1100, auto: false, recoil: 0.75, color: 0xa5926b, accent: 0x3a3224, level: 3, archetype: "pistol", boxOnly: true, boxTier: "standard", boxWeight: 16 },
  chain_feeder: { id: "chain_feeder", rarity: "common", damage: 11, fireRate: 75, magSize: 40,
    reloadTime: 2400, auto: true, recoil: 0.45, color: 0x757d6a, accent: 0x2b3026, level: 3, archetype: "lmg", boxOnly: true, boxTier: "standard", boxWeight: 16 },
  blast_door: { id: "blast_door", rarity: "common", damage: 13, pellets: 6, spread: 0.08, fireRate: 800, magSize: 5,
    reloadTime: 1800, auto: false, recoil: 1.8, color: 0x8a8578, accent: 0x33302a, level: 3, archetype: "shotgun", boxOnly: true, boxTier: "standard", boxWeight: 14 },
  tri_burst: { id: "tri_burst", rarity: "uncommon", damage: 25, burst: 3, burstDelay: 55, fireRate: 350, magSize: 27,
    reloadTime: 1500, auto: false, recoil: 0.85, color: 0x4f8a5a, accent: 0x1b3320, level: 3, archetype: "rifle", boxOnly: true, boxTier: "standard", boxWeight: 12 },
  sledge_shot: { id: "sledge_shot", rarity: "uncommon", damage: 40, fireRate: 480, magSize: 8,
    reloadTime: 1600, auto: false, recoil: 1.4, color: 0xa2603a, accent: 0x40261a, level: 3, archetype: "cannon", boxOnly: true, boxTier: "standard", boxWeight: 11 },
  rail_spike: { id: "rail_spike", rarity: "rare", damage: 62, pierce: 4, fireRate: 600, magSize: 8,
    reloadTime: 1900, auto: false, recoil: 1.4, color: 0x6fa8d9, accent: 0x1e3850, level: 3, archetype: "beam", boxOnly: true, boxTier: "standard", boxWeight: 8 },
  arc_welder: { id: "arc_welder", rarity: "rare", damage: 44, charge: { time: 0.85, mult: 2.7 }, fireRate: 680, magSize: 9,
    reloadTime: 1800, auto: false, recoil: 1.2, color: 0x7fe6ff, accent: 0x1d4c63, level: 3, archetype: "energy", boxOnly: true, boxTier: "standard", boxWeight: 7 },
  mag_driver: { id: "mag_driver", rarity: "rare", damage: 125, scope: 28, fireRate: 980, magSize: 5,
    reloadTime: 1900, auto: false, recoil: 2.2, color: 0x9c6bd6, accent: 0x33225c, level: 3, archetype: "sniper", boxOnly: true, boxTier: "standard", boxWeight: 4 },
  mortar_pup: { id: "mortar_pup", rarity: "rare", damage: 66, fireRate: 880, magSize: 5,
    reloadTime: 2000, auto: false, splash: true, splashRadius: 3.8, recoil: 1.9, color: 0xd9b23c, accent: 0x4a3a10, level: 3, archetype: "launcher", boxOnly: true, boxTier: "standard", boxWeight: 3 },
  reactor_core: { id: "reactor_core", rarity: "epic", damage: 78, charge: { time: 1.2, mult: 3.6 }, fireRate: 900, magSize: 6,
    reloadTime: 2300, auto: false, recoil: 2.0, color: 0xff9a4d, accent: 0x50290c, level: 3, archetype: "cannon", boxOnly: true, boxTier: "elite", boxWeight: 32 },
  last_stand: { id: "last_stand", rarity: "epic", damage: 46, fireRate: 80, magSize: 60,
    reloadTime: 2500, auto: true, recoil: 0.9, color: 0xc23bef, accent: 0x3d1a4a, level: 3, archetype: "lmg", boxOnly: true, boxTier: "elite", boxWeight: 26 },
  doomsday: { id: "doomsday", rarity: "secret", damage: 260, fireRate: 1500, magSize: 2,
    reloadTime: 3000, auto: false, splash: true, splashRadius: 7.0, recoil: 3.0, color: 0xffd43b, accent: 0x6b3a08, level: 3, archetype: "cannon", boxOnly: true, boxTier: "elite", boxWeight: 10 },
});

G.MELEE_DEF = { id: "melee", damage: 35, fireRate: 450, range: 2.6 };

// damage values scaled 3.75x to match player HP going 100 -> 375 (same % dmg/hit)
// (overhaul, round 4) ten kinds -- docs/overhaul/zombie-concepts.md. The ids of
// the first three stay what saves and checkpoints know: normal is the
// Shambler, fast the Sprinter, crawler the Crawler. Against the Shambler:
// hp and speed as the concept sheet sets them; `scale` is the whole body (a
// Runt's hitboxes are smaller -- its word is not); their own rules are
// G.CONFIG.zombies.
G.ZOMBIE_TYPES = {
  normal:      { hp: 34, speed: 1.7, scale: 1.0, color: 0x4c6b3a, damage: 30, scoreValue: 10 },
  fast:        { hp: 22, speed: 3.1, scale: 0.95, color: 0x8a6a2a, damage: 23, scoreValue: 16 },
  crawler:     { hp: 27, speed: 1.05, scale: 0.9, color: 0x5c5449, damage: 26, scoreValue: 14 },
  bloater:     { hp: 54, speed: 1.05, scale: 1.06, color: 0x7a8a4a, damage: 30, scoreValue: 22 },
  ironclad:    { hp: 34, speed: 1.3, scale: 1.04, color: 0x5a6068, damage: 34, scoreValue: 24 },
  runt:        { hp: 17, speed: 2.7, scale: 0.62, color: 0x6b5a3a, damage: 18, scoreValue: 18 },
  abomination: { hp: 102, speed: 1.85, scale: 1.24, color: 0x6a2a2a, damage: 52, scoreValue: 60 },
  screamer:    { hp: 27, speed: 1.55, scale: 1.12, color: 0x9a9a8a, damage: 22, scoreValue: 22 },
  headless:    { hp: 37, speed: 1.55, scale: 1.0, color: 0x5c4a3a, damage: 30, scoreValue: 20 },
  reacher:     { hp: 61, speed: 1.2, scale: 1.16, color: 0x4a5a4a, damage: 40, scoreValue: 30 },
  boss:        { hp: 900, speed: 1.0, scale: 3.0, color: 0x6b1e6b, damage: 83, scoreValue: 500 },
};
// the ten in the order of the concept sheet (the Zombie Gallery, ?lab=zombies)
G.ZOMBIE_KINDS = ["normal", "fast", "crawler", "bloater", "ironclad", "runt", "abomination", "screamer", "headless", "reacher"];

// ---------------- The waves (new list, round 2, F) ----------------
// Twenty waves a level. The first four ease a new player in; 5, 10, 15 and 20
// end with a boss (js/bosses.js) once their own zombies are down; in between
// there are more zombies each wave, a little faster, and more of the quick
// and the crawling kinds. One row per wave, for the school; the hospital and
// the bunker take the same curve a notch harder (G.waveSpec).
//   kills     zombies in the wave (a boss wave's, before its boss)
//   speed     their walking speed, x the kind's own
//   fast      share of fast zombies; crawler: of crawlers
//   alive     at most this many at once
//   every     seconds between spawns
G.WAVE_COUNT = 20;
G.BOSS_EVERY = 5;
G.WAVE_TABLE = [
  // kills speed fast crawler alive every
  [6, 0.85, 0.00, 0.05, 4, 4.6],     // 1
  [8, 0.90, 0.06, 0.06, 5, 4.2],     // 2
  [10, 0.95, 0.10, 0.08, 5, 3.9],    // 3
  [12, 1.00, 0.14, 0.09, 6, 3.6],    // 4
  [12, 1.00, 0.15, 0.10, 6, 3.5],    // 5  boss
  [14, 1.03, 0.18, 0.10, 7, 3.3],    // 6
  [15, 1.05, 0.20, 0.11, 7, 3.1],    // 7
  [16, 1.07, 0.22, 0.11, 7, 3.0],    // 8
  [17, 1.09, 0.24, 0.12, 8, 2.9],    // 9
  [16, 1.10, 0.25, 0.12, 8, 2.8],    // 10 boss
  [18, 1.12, 0.27, 0.12, 8, 2.7],    // 11
  [19, 1.14, 0.29, 0.13, 9, 2.6],    // 12
  [20, 1.16, 0.31, 0.13, 9, 2.5],    // 13
  [21, 1.18, 0.33, 0.14, 9, 2.4],    // 14
  [20, 1.19, 0.34, 0.14, 9, 2.3],    // 15 boss
  [22, 1.21, 0.36, 0.14, 10, 2.2],   // 16
  [23, 1.23, 0.38, 0.15, 10, 2.1],   // 17
  [24, 1.25, 0.40, 0.15, 10, 2.0],   // 18
  [25, 1.27, 0.42, 0.15, 11, 1.9],   // 19
  [22, 1.28, 0.44, 0.16, 11, 1.8],   // 20 boss
];

// ---------------- Money (new list, round 2, F) ----------------
// Twenty waves earn four times what five did, so what a run buys is priced
// to match: the prices below are the old ones scaled, and the growth of the
// two essentials is gentler (bought every wave for twenty waves, the old
// 20%-a-time growth reached thirty times the first price).
G.ECONOMY = {
  waveBonus: (wave) => 50 + 10 * wave,           // a cleared wave, before the shop
  bossBounty: (wave) => 200 + 30 * wave,         // a boss down
  perkScale: 1.3,                                 // every perk's price
  gunScale: 1.25,                                 // wall guns
};

// labels are "shopItem.<id>" in js/strings.js, set on load by G.localizeData.
// Full Health and Full Ammo are on sale at every shop; the perks rotate
// (G.PERKS and G.PerkBag in js/perks.js); the rest is the armory.
// (round 2: priced for twenty waves -- see G.ECONOMY)
G.SHOP_ITEMS = [
  { id: "heal", base: 150, growth: 1.07, kind: "heal", section: "essential" },
  { id: "ammo_refill", base: 100, growth: 1.06, kind: "refill_ammo", section: "essential" },
  { id: "dmg_up", base: 300, growth: 1.35, kind: "upgrade_damage" },
  { id: "firerate_up", base: 350, growth: 1.35, kind: "upgrade_firerate" },
  { id: "mag_up", base: 260, growth: 1.3, kind: "upgrade_mag" },
  { id: "unlock_shotgun", base: 500, growth: 1, kind: "unlock", weapon: "shotgun", once: true },
  { id: "unlock_smg", base: 1100, growth: 1, kind: "unlock", weapon: "smg", once: true },
  { id: "unlock_rifle", base: 1500, growth: 1, kind: "unlock", weapon: "rifle", once: true },
  { id: "crate_common", base: 750, growth: 1.15, kind: "crate" },
];

// cat: move | shoot | survive | money | vocab. `vals` holds the figures per
// level (index 0 = level 1) that the description and the effect both read.
G.PERKS = [
  // ---- the word game ----
  { id: "perk_hint", icon: "🔤", cat: "vocab", max: 2, base: 300, growth: 1.6, vals: [1, 2] },               // 1: first letter, 2: + letter count
  { id: "focus_time", icon: "⏳", cat: "vocab", max: 2, base: 450, growth: 1.6, vals: [1.5, 2.5] },          // seconds of slowed zombies after a right answer
  { id: "combo_shield", icon: "🛡️", cat: "vocab", max: 1, base: 400, growth: 1, vals: [5] },                 // right answers to recharge
  { id: "word_bounty", icon: "💎", cat: "vocab", max: 2, base: 350, growth: 1.7, vals: [75, 150] },          // % extra money for a hard word
  { id: "extra_time", icon: "⏱️", cat: "vocab", max: 2, base: 300, growth: 1.6, vals: [4, 8] },              // seconds added to word questions
  // ---- movement ----
  { id: "perk_speed", icon: "👟", cat: "move", max: 2, base: 350, growth: 1.5, vals: [15, 30] },             // % move speed
  { id: "second_wind", icon: "💨", cat: "move", max: 1, base: 350, growth: 1, vals: [2] },                   // stamina regen multiplier
  { id: "pack_mule", icon: "🎒", cat: "move", max: 1, base: 400, growth: 1, vals: [50] },                    // % of the weight penalty removed
  { id: "adrenaline", icon: "⚡", cat: "move", max: 1, base: 350, growth: 1, vals: [35] },                   // % speed for 3 s after a kill
  // ---- shooting ----
  { id: "quick_hands", icon: "✋", cat: "shoot", max: 2, base: 400, growth: 1.6, vals: [35, 70] },           // % faster reloads and swaps
  { id: "piercing_rounds", icon: "➶", cat: "shoot", max: 2, base: 500, growth: 1.7, vals: [1, 2] },          // extra zombies a bullet goes through
  { id: "last_round", icon: "🎯", cat: "shoot", max: 2, base: 350, growth: 1.6, vals: [1, 2] },              // last N rounds of a magazine hit 3x
  { id: "marksman", icon: "🔭", cat: "shoot", max: 1, base: 450, growth: 1, vals: [40] },                    // % damage while aiming
  // ---- survival ----
  { id: "bloodthirst", icon: "🩸", cat: "survive", max: 2, base: 400, growth: 1.6, vals: [[10, 30], [20, 60]] }, // HP per kill / per right kill
  { id: "perk_armor", icon: "🦺", cat: "survive", max: 2, base: 400, growth: 1.5, vals: [12, 24] },          // % less damage from bites and traps
  { id: "second_life", icon: "❤️‍🔥", cat: "survive", max: 1, base: 700, growth: 1, vals: [25] },          // % HP a fatal hit leaves you with
  { id: "thorns", icon: "🌵", cat: "survive", max: 2, base: 350, growth: 1.6, vals: [60, 120] },             // damage back to a zombie that bites
  // ---- money and loadout ----
  { id: "extra_slot", icon: "➕", cat: "money", max: 2, base: 900, growth: 1.8, vals: [1, 2] },              // extra gun slots
  { id: "interest", icon: "🏦", cat: "money", max: 2, base: 500, growth: 1.7, vals: [[10, 250], [15, 400]] }, // % of banked money paid at each shop, capped
  { id: "lucky_charm", icon: "🍀", cat: "money", max: 2, base: 600, growth: 1.8, vals: [2, 3] },             // crate rarity rolls, best one kept
];

// Accuracy bars were 75/80/85%. The category P playtest showed why that was
// out of reach: accuracy counts EVERY wrong kill -- a panic shot at a zombie
// biting you, a stray round, a launcher's splash -- so players who knew about
// three words in four finished at 55-73%, then sat in overtime until they died.
// The bar is now 65/70/75%, and it only has to be reached once (see `latched`).
// Round 3: the school is three storeys and a campus now -- forty rooms and
// eight places outside (the field, the garden, the three salas...). Exploring
// asks for 24 of those (rooms and places both count), and the level asks for
// four of the story notes to be read, which is also what the third floor's
// grille wants (with 40 right answers), so a player finishing the level has
// the third floor within reach without it being required.
// Round 2: twenty waves, so the word goal is sized for them (the school
// sends about 340 zombies in twenty waves, the hospital 370, the bunker
// 400: the goal is under half of those) and the boss goal is every one of
// the level's four bosses.
G.LEVEL_OBJECTIVES = {
  1: { accuracy: 0.65, minCorrect: 150, rooms: 24, keys: 3, notes: 4, bosses: 4 },
  2: { accuracy: 0.70, minCorrect: 165, rooms: 19, keys: 3, bosses: 4 },
  3: { accuracy: 0.75, minCorrect: 180, rooms: 20, keys: 3, bosses: 4 },
};

// ---------------- The twenty abilities (js/abilities.js) ----------------
// cd: cooldown in seconds; dur: how long its effect lasts. What each one
// does with its numbers is G.CONFIG.abilities above.
G.ABILITIES = [
  { id: "dash", icon: "💨", cat: "move", cd: 6 },
  { id: "overdrive", icon: "⚡", cat: "move", cd: 24, dur: 6 },
  { id: "vault", icon: "🦘", cat: "move", cd: 10 },
  { id: "rewind", icon: "⏪", cat: "move", cd: 20 },
  { id: "barrier", icon: "🛡️", cat: "defend", cd: 22, dur: 4 },
  { id: "smoke", icon: "🌫️", cat: "defend", cd: 24, dur: 5 },
  { id: "decoy", icon: "🎭", cat: "defend", cd: 22, dur: 6 },
  { id: "patch", icon: "🩹", cat: "defend", cd: 30, dur: 3 },
  { id: "freeze", icon: "🧊", cat: "control", cd: 14, dur: 4.5 },
  { id: "shockwave", icon: "🌀", cat: "control", cd: 12 },
  { id: "timewarp", icon: "⏳", cat: "control", cd: 22, dur: 5 },
  { id: "glue", icon: "🍯", cat: "control", cd: 18, dur: 8 },
  { id: "flashbang", icon: "✨", cat: "control", cd: 16, dur: 2.5 },
  { id: "well", icon: "🧿", cat: "control", cd: 20, dur: 3 },
  { id: "radar", icon: "📡", cat: "words", cd: 20, dur: 8 },
  { id: "whisper", icon: "🔡", cat: "words", cd: 25, dur: 10 },
  { id: "fifty", icon: "✂️", cat: "words", cd: 30, dur: 10 },
  { id: "lens", icon: "🔍", cat: "words", cd: 40, dur: 6 },
  { id: "resupply", icon: "📦", cat: "support", cd: 28 },
  { id: "magnet", icon: "🧲", cat: "support", cd: 25 },
];
