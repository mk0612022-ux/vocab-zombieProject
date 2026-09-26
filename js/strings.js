// ===================================================================
// Every piece of text the player sees, in one place
// -------------------------------------------------------------------
//   G.T("key", { name: value })   the string for `key` in G.lang, with
//                                 {name} placeholders filled in
//   data-i18n="key"               static HTML text (data-i18n-html for text
//                                 with markup, data-i18n-aria for aria-label)
//   G.localizeData()              names and labels that live on game data
//                                 (levels, weapons, achievements, shop items,
//                                 rarity and weight labels) -- by id, so no
//                                 save data ever depends on the text
// The Thai meanings of the vocabulary are NOT here: they are the learning
// content and stay in js/data/words_*.js. To add a language, add a block
// beside `en` with the same keys and set G.lang; anything missing falls
// back to English.
// ===================================================================
window.G = window.G || {};
G.lang = "en";
G.STRINGS = {
  en: {
    // ---- main menu ----
    "menu.title": "VOCAB <span class=\"accent\">ZOMBIE</span>",
    "menu.subtitle": "IELTS Survival FPS",
    "menu.start": "Start Game",
    "menu.practice": "Practice Mode",
    "menu.daily": "Daily Challenge",
    "menu.endless": "Endless Mode",
    "menu.leaderboard": "Leaderboard",
    "menu.achievements": "Achievements",
    "menu.vocablog": "Word Log",
    "menu.weaponlog": "Armory",
    "menu.import": "Import Vocabulary",
    "menu.howto": "How to Play",
    "menu.tutorial": "Replay Tutorial",
    "menu.settings": "Settings",
    "menu.footer": "v0.1 · Made with Three.js",
    "common.back": "Back",
    "common.mainMenu": "Main Menu",
    "common.loading": "Loading...",
    "common.level": "Level {n}",
    "common.levelNamed": "Level {n}: {name}",
    "common.unknown": "unknown",

    // ---- level select ----
    "levels.title": "Select Level",
    "levels.back": "Back to Main Menu",
    "levels.info": "{waves} waves · Difficulty {diff}x",
    "levels.best": "Best score: {score}",
    "levels.locked": "🔒 Clear the previous level to unlock",
    "level.1": "Abandoned School",
    "level.2": "Abandoned Hospital",
    "level.3": "Underground Bunker",
    "level.daily": "Daily Challenge",
    "level.endless": "Endless",

    // ---- how to play ----
    "howto.title": "How to Play",
    "howto.body": "<p>The top of the screen shows the <strong>Thai meaning</strong> of a word — find the zombie carrying the English word with that meaning and shoot it!</p>"
      + "<ul><li><b>WASD</b> move, <b>Mouse</b> look, <b>Left click</b> shoot, <b>Hold right click</b> aim (zoom)</li>"
      + "<li><b>R</b> reload, <b>E</b> use / pick up, <b>Shift</b> sprint (uses the blue stamina bar, which refills when you stop)</li>"
      + "<li><b>1</b> knife (unlimited melee), <b>2-5</b> switch guns</li>"
      + "<li><b>ESC</b> pause</li>"
      + "<li>Right zombie = score + money / wrong zombie = you lose health and the rest speed up</li>"
      + "<li>Between waves the shop sells upgrades, weapons and items</li></ul>",

    // ---- settings ----
    "settings.title": "Settings",
    "settings.controls": "Controls",
    "settings.controlMode": "Control mode",
    "settings.controlAuto": "Automatic",
    "settings.controlDesktop": "Desktop Controls",
    "settings.controlTouch": "Touch Controls",
    "settings.mouseSens": "Mouse sensitivity ({v})",
    "settings.touchLayout": "Touch controls (position / size / opacity / sensitivity)",
    "settings.touchLayoutBtn": "Customize Controls",
    "settings.keybinds": "Key Bindings",
    "settings.resetKeys": "Reset to Default",
    "settings.audio": "Audio",
    "settings.sfxVolume": "Sound effects (guns, zombies, footsteps) ({v}%)",
    "settings.musicVolume": "Music ({v}%)",
    "settings.ambientVolume": "Ambience ({v}%)",
    "settings.speechVolume": "Word pronunciation ({v}%)",
    "settings.speechMode": "Read words aloud automatically",
    "settings.speechAfter": "After a correct answer (recommended)",
    "settings.speechBefore": "As soon as a new word appears (easier)",
    "settings.speechOff": "Off",
    "settings.speechTest": "Test Pronunciation",
    "settings.performance": "Performance",
    "settings.fpsCap": "FPS Cap",
    "settings.unlimited": "Unlimited",
    "settings.showFps": "Show FPS counter",
    "settings.showDraws": "Show draw call count",
    "settings.quality": "Graphics quality",
    "settings.qVlow": "Very Low", "settings.qLow": "Low", "settings.qMedium": "Medium", "settings.qHigh": "High", "settings.qVhigh": "Very High",
    "settings.gameSpeed": "Game speed ({v}x)",
    "settings.accessibility": "Accessibility",
    "settings.fontSize": "Text size",
    "settings.fontSmall": "Small", "settings.fontMedium": "Medium", "settings.fontLarge": "Large",
    "settings.colorblind": "Colorblind mode (adds rarity icons)",
    "settings.headBob": "Camera bob while walking/running ({v}%)",
    "settings.headBobOff": "Turn off camera bob entirely (for motion sickness)",
    "settings.saveData": "Save Data",
    "settings.exportSave": "Export Save",
    "settings.importSave": "Import Save",
    "key.forward": "Forward", "key.back": "Back", "key.left": "Left", "key.right": "Right", "key.sprint": "Sprint", "key.jump": "Jump",
    "key.reload": "Reload", "key.interact": "Interact", "key.melee": "Knife", "key.slot2": "Weapon slot 2", "key.slot3": "Weapon slot 3",
    "key.slot4": "Weapon slot 4", "key.slot5": "Weapon slot 5", "key.pause": "Pause",
    "save.importFailed": "Import failed: {msg}",
    "save.importConfirm": "Importing will overwrite ALL of your current progress.\n\n"
      + "File to import (exported {when}):\n"
      + "  Levels unlocked {al} · Words with stats {aw} · Achievements {aa} · Guns found {ag}\n\n"
      + "Current progress that will be replaced:\n"
      + "  Levels unlocked {bl} · Words with stats {bw} · Achievements {ba} · Guns found {bg}\n\n"
      + "Import this save?",
    "save.importDone": "Save imported",
    "save.persistFailTitle": "Can't save progress",
    "save.persistFailText": "The browser won't store data (private mode?) — use Export Save to keep a copy",
    "save.errRead": "Couldn't read the file",
    "save.errJson": "This file isn't JSON",
    "save.errNotSave": "This file isn't a Vocab Zombie save",
    "save.errCorrupt": "The save data in this file is damaged",

    // ---- leaderboard / achievements ----
    "leaderboard.title": "Leaderboard",
    "leaderboard.daily": "Daily",
    "leaderboard.endless": "Endless",
    "leaderboard.empty": "No scores yet",
    "achievements.title": "Achievements",
    "achievements.unlocked": "🏅 Achievement unlocked!",
    "ach.streak50.name": "Word Scholar", "ach.streak50.desc": "Answer 50 words correctly in a row",
    "ach.secret_crate.name": "Golden Fortune", "ach.secret_crate.desc": "Open a Secret/Legendary weapon crate",
    "ach.no_hit_level.name": "Untouchable", "ach.no_hit_level.desc": "Clear a level without a zombie ever touching you",
    "ach.all_levels.name": "Zombie Conqueror", "ach.all_levels.desc": "Clear every level in the game",
    "ach.first_boss.name": "Boss Hunter", "ach.first_boss.desc": "Defeat your first boss",
    "ach.endless_10.name": "Iron Will", "ach.endless_10.desc": "Survive to wave 10 in Endless Mode",

    // ---- word log ----
    "vocablog.title": "Word Log",
    "vocablog.unseen": "Not seen yet",
    "vocablog.right": "Right {n}",
    "vocablog.wrong": "Wrong {n}",
    "vocablog.hear": "Hear {word}",

    // ---- armory (weapon log) ----
    "weaponlog.title": "Armory",
    "weaponlog.wall": "🔒 Wall guns in this level ({n})",
    "weaponlog.box": "🎴 Mystery box (${cost} a try)",
    "weaponlog.locked": "Locked",
    "weaponlog.odds": "Drop chance: {p}",
    "weaponlog.damage": "Damage: {d}",
    "weaponlog.pellets": " x{n} pellets",
    "weaponlog.rate": "Fire rate: {r}/s",
    "weaponlog.mag": "Magazine: {n}",
    "weaponlog.dps": "Est. DPS: {n}",
    "weaponlog.price": "Price: ${p}",
    "weaponlog.listen": "🔊 Listen",
    "weapon.mode": "Mode: {m}",
    "weapon.weight": "Weight: {w} ({v})",
    "weapon.speedPenalty": "Speed -{p}%",
    "weapon.noPenalty": "No speed penalty",
    "weapon.reload": "Reload: {s}s",
    "weapon.recoil": "Recoil: {r}",
    "weapon.pierce": "pierces",
    "weapon.splash": "area blast",
    "fire.melee": "Melee",
    "fire.charge": "Charge",
    "fire.splash": "Explosive",
    "fire.pellets": "Buckshot x{n}",
    "fire.scope": "Sniper (scoped)",
    "fire.burst": "{n}-round burst",
    "fire.pierce": "Pierces {n}",
    "fire.pierceAll": "Pierces all",
    "fire.auto": "Automatic",
    "fire.semi": "Semi-auto",
    "weight.light": "Light", "weight.medium": "Medium", "weight.heavy": "Heavy", "weight.very_heavy": "Very heavy",
    "rarity.common": "COMMON", "rarity.uncommon": "UNCOMMON", "rarity.rare": "RARE", "rarity.epic": "EPIC", "rarity.secret": "SECRET",

    // ---- import vocabulary ----
    "import.title": "Import Vocabulary",
    "import.fileHint": "Upload a .csv or .txt file with one <code>english,Thai meaning</code> pair per line",
    "import.ocrHint": "Or take a photo of a vocabulary page (basic OCR — needs internet the first time to load the library):",
    "import.save": "Save This Word Set",
    "import.sets": "Imported Word Sets",
    "import.more": "... and {n} more",
    "import.none": "No valid words found",
    "import.ocrLoading": "Loading the OCR library (may take a moment the first time)...",
    "import.ocrReading": "Reading text from the image...",
    "import.ocrDone": "Done — check and fix the words before saving",
    "import.ocrFailed": "OCR failed: {msg} — try a CSV file instead",
    "import.ocrNoLib": "Couldn't load the OCR library (needs internet) — use a CSV file instead",
    "import.saved": "Word set saved — you can use it in Practice Mode",
    "import.setRow": "{name} ({n} words)",
    "import.delete": "Delete",
    "import.empty": "No imported word sets yet",

    // ---- practice mode ----
    "practice.title": "Practice Mode",
    "practice.quit": "End Practice",
    "practice.choose": "Choose a word set to practise:",
    "practice.weak": "Words I often get wrong",
    "practice.start": "Start Practice",
    "practice.notEnough": "This word set doesn't have enough words to practise (needs at least 4 meanings)",
    "practice.done": "Practice complete! {c}/{n} correct",
    "practice.correct": "Correct!",
    "practice.wrong": "Wrong — the answer is \"{a}\"",

    // ---- results ----
    "result.gameOver": "GAME OVER",
    "result.victory": "VICTORY!",
    "result.retry": "Retry",
    "result.playAgain": "Play Again",
    "result.levelSelect": "Level Select",
    "result.score": "Score",
    "result.wave": "Wave reached",
    "result.correct": "Correct",
    "result.wrong": "Wrong",
    "result.money": "Money earned",
    "result.review": "Words to review",
    "result.wrongTimes": "wrong {n}×",
    "result.perfect": "Great job — no wrong answers!",

    // ---- HUD ----
    "hud.shootMeaning": "Shoot the word meaning",
    "hud.hearAgain": "Hear the word again",
    "hud.boss": "BOSS",
    "hud.zombieBoss": "ZOMBIE BOSS",
    "hud.meaning": "Meaning: {m}",
    "hud.bossHintTouch": "Tap the right answer",
    "hud.bossHintDesk": "Click an answer or press 1-4",
    "hud.skipTutorial": "Skip tutorial",
    "hud.combo": "COMBO x{n}",
    "hud.resume": "Click the screen to resume",
    "hud.interact": "Press E to interact",
    "hud.answerToUnlock": "Answer to unlock",
    "hud.waiting": "Waiting for zombies...",
    "hud.hintFirst": "  (starts with \"{c}\")",
    "hud.levelWave": "{level} · Wave {wave}",
    "hud.overtime": " (overtime)",
    "hud.objectives": "Objectives {d}/{n}",
    "hud.zombies": "Zombies: {n}",
    "hud.ammoMelee": "∞",
    "hud.fps": "{n} FPS",
    "hud.draws": "{n} draw calls",
    "hud.tris": "{n}k tris",

    // ---- prompts (press E) ----
    "prompt.wordDoor": "Press E to try the door (answer a word)",
    "prompt.buttonDone": "Pressed",
    "prompt.button": "Press E to push the button",
    "prompt.crate": "Press E to open the crate",
    "prompt.trap": "Press E to disarm the trap (answer a word)",
    "prompt.hatch": "Press E to open the hatch (answer a word)",
    "prompt.doorClose": "Press E to close",
    "prompt.doorOpen": "Press E to open",
    "prompt.mystery": "Press E to roll a gun (${cost})",
    "prompt.notEnough": " - not enough money",
    "prompt.wallGun": "Press E to buy {name} (${price}{short}) · {weight}",

    // ---- word challenges (doors, crates, traps, hatches) ----
    "challenge.crate": "Answer to unlock the crate",
    "challenge.door": "Answer to open the door",
    "challenge.trap": "Answer to disarm the trap",
    "challenge.hatch": "Answer to open the hatch",

    // ---- banners and messages during play ----
    "banner.unlocked": "Unlocked",
    "banner.objectivesLeft": "Objectives not complete!",
    "banner.objectivesLeftText": "Zombies will keep coming until every objective is done (see the HUD / pause screen)",
    "banner.noMoney": "Not enough money",
    "banner.noMoneyText": "Costs ${cost} · you have ${have}",
    "banner.upstairs": "2nd floor unlocked!",
    "banner.upstairsText": "{n} zombies down",
    "banner.explored": "All explored!",
    "banner.exploredText": "Entered {n} rooms",
    "banner.key": "Key found!",
    "banner.keyText": "{k} / {n} keys",
    "banner.allObjectives": "Objectives complete!",
    "banner.clearThisWave": "Clear this wave to finish the level",
    "banner.surviveAll": "Survive every wave to finish the level",

    // ---- objectives ----
    "obj.title": "Level objectives ({d}/{n})",
    "obj.survive": "Survive all {n} waves",
    "obj.correct": "Answer at least {n} words correctly",
    "obj.accuracy": "Word accuracy of {p}% or better",
    "obj.explore": "Explore {n} rooms",
    "obj.keys": "Find the {n} hidden keys",
    "obj.boss": "Defeat the level boss",
    "obj.bossDone": "Done",
    "obj.bossNot": "Not yet",

    // ---- shop ----
    "shop.title": "Shop",
    "shop.timer": "Next wave in {s}s",
    "shop.money": "Money: ",
    "shop.continue": "Start Next Wave",
    "shop.bonus": "Wave {w} cleared · bonus +${b}",
    "shop.level": "Level: {s}/{m}",
    "shop.owned": "Owned",
    "shop.max": "MAX",
    "shop.buy": "Buy",
    "shopItem.dmg_up": "Current weapon damage +15%",
    "shopItem.firerate_up": "Current weapon fire rate +10%",
    "shopItem.mag_up": "Magazine size +20%",
    "shopItem.ammo_refill": "Refill all ammo",
    "shopItem.heal": "Full heal",
    "shopItem.unlock_shotgun": "Unlock Shotgun",
    "shopItem.unlock_smg": "Unlock SMG",
    "shopItem.unlock_rifle": "Unlock Rifle",
    "shopItem.perk_speed": "Perk: Move speed +15%",
    "shopItem.perk_armor": "Perk: Armor, 10% less damage taken",
    "shopItem.perk_hint": "Perk: Hint the answer's first letter",
    "shopItem.crate_common": "Weapon crate (any rarity)",

    // ---- crate and mystery box ----
    "crate.ok": "OK",
    "crate.stats": "Damage: {d}<br>Fire rate: {r} rounds/s<br>Magazine: {m}<br>",
    "mystery.pick": "Pick 1 card",
    "mystery.pickSub": "One of them is a top-tier gun — try your luck",
    "mystery.take": "Take Gun",
    "mystery.reveal": "All cards revealed",
    "mystery.revealSub": "See what you missed",
    "mystery.yourPick": "← your pick",
    "mystery.dps": "DPS ~{n}",
    "mystery.elite": "  ★ ELITE",

    // ---- pause ----
    "pause.title": "Paused",
    "pause.resume": "Resume",
    "pause.tutorial": "Restart Tutorial",

    // ---- tutorial ----
    "tut.move.title": "Move and look",
    "tut.move.desk": "Walk with W A S D · move the mouse to look · Shift to sprint · Space to jump",
    "tut.move.touch": "Drag the joystick (bottom left) to walk · drag on the right half of the screen to look · \"RUN\" to sprint",
    "tut.rule.title": "The main rule",
    "tut.rule.desk": "Read the Thai meaning at the top, then shoot the zombie carrying the matching English word — the wrong word costs health and speeds the zombies up",
    "tut.rule.touch": "Read the Thai meaning at the top, then shoot the zombie carrying the matching English word — the wrong word costs health and speeds the zombies up",
    "tut.shoot.title": "Shooting",
    "tut.shoot.desk": "Left click to shoot · hold right click to aim · R to reload · 1-5 to switch weapons · V to hear the word again",
    "tut.shoot.touch": "FIRE to shoot · AIM to zoom · R to reload · the number row switches weapons · 🔊 hears the word",
    "tut.door.title": "Doors",
    "tut.door.desk": "Press E to open or close a door — a closed door holds zombies back for a while",
    "tut.door.touch": "Press E to open or close a door — a closed door holds zombies back for a while",
    "tut.pickup.title": "Items",
    "tut.pickup.desk": "Walk over items to pick them up: money, ammo, health and weapon crates",
    "tut.pickup.touch": "Walk over items to pick them up: money, ammo, health and weapon crates",
    "tut.objectives.title": "Level goals",
    "tut.objectives.desk": "Surviving isn't enough — check \"Objectives x/6\" on the right, or press ESC for the full list (3 keys, rooms to explore, accuracy and the boss)",
    "tut.objectives.touch": "Surviving isn't enough — check \"Objectives x/6\" on the right, or press II for the full list (3 keys, rooms to explore, accuracy and the boss)",
    "tut.wallgun.title": "Wall guns",
    "tut.wallgun.desk": "Guns on the walls can be bought (press E when you have the money) — the heavier the gun, the slower you move and the faster you tire",
    "tut.wallgun.touch": "Guns on the walls can be bought (press E when you have the money) — the heavier the gun, the slower you move and the faster you tire",
    "tut.mystery.title": "Mystery box",
    "tut.mystery.desk": "$1,000 a try: pick 1 of 6 cards — one of them is always top tier",
    "tut.mystery.touch": "$1,000 a try: pick 1 of 6 cards — one of them is always top tier",
    "tut.shopTip": "The shop opens between waves: spend what your right answers earned on upgrades, perks or a random weapon crate — the clock is ticking",

    // ---- touch controls and layout editor ----
    "touch.fire": "FIRE", "touch.aim": "AIM", "touch.interact": "E", "touch.reload": "R", "touch.jump": "JUMP", "touch.sprint": "RUN", "touch.pause": "II",
    "touchcfg.title": "Customize Controls",
    "touchcfg.hide": "Hide",
    "touchcfg.show": "Show",
    "touchcfg.hint": "Drag a button to move it · tap a button once to select it, then resize it below",
    "touchcfg.selected": "Selected",
    "touchcfg.none": "— tap a button to select —",
    "touchcfg.size": "Button size",
    "touchcfg.small": "Small", "touchcfg.medium": "Medium", "touchcfg.large": "Large",
    "touchcfg.resetOne": "Reset this button",
    "touchcfg.opacity": "Button opacity",
    "touchcfg.sens": "Look drag sensitivity",
    "touchcfg.resetAll": "Reset All",
    "touchcfg.done": "Done",
    "touchcfg.confirmReset": "Reset every position, size, opacity and sensitivity to default?",
    "touchcfg.joystick": "Move stick", "touchcfg.fire": "Fire button (FIRE)", "touchcfg.ads": "Aim button", "touchcfg.interact": "Use button (E)",
    "touchcfg.reload": "Reload button (R)", "touchcfg.jump": "Jump button", "touchcfg.sprint": "Run button", "touchcfg.pause": "Pause button",
    "touchcfg.slots": "Weapon row",

    // ---- signs and posters in the world ----
    "world.wallWeight": "Weight: {w}",
    "world.info": "Information",
    "world.schoolName": "BAN NONG SCHOOL",
    "world.welcome": "Welcome",
    "world.banner1": "WIN", "world.banner2": "GO TEAM", "world.banner3": "OUR TEAM",
    "world.home": "HOME", "world.away": "AWAY",
    "world.emergency": "Emergency Dept.",
    "world.emergencySub": "THIS WAY  →",
    "world.triage": "TRIAGE",
    "world.blastDoor": "Blast Door",
    "world.sealed": "SEALED",
    "world.reactor": "Reactor Room",
    "world.coreUnstable": "CORE  UNSTABLE",
    "poster.noRunning": "NO RUNNING",
    "poster.numbers": "1 2 3",
    "poster.abc": "ABC",
    "poster.worldMap": "WORLD MAP",
    "poster.clean": "KEEP IT CLEAN",
    "poster.periodic": "PERIODIC TABLE",
    "poster.exams": "EXAM WEEK!",
    "poster.greens": "EAT YOUR GREENS",
    "notice.1": "NOTICE", "notice.2": "NO CLASS", "notice.3": "SPORTS DAY", "notice.4": "MIDTERMS", "notice.5": "LOST CAT", "notice.6": "CLUBS",
    "sign.extinguisher": "FIRE EXTINGUISHER",

    // ---- weapon names ----
    "weapon.melee": "Combat Knife",
    "weapon.pistol": "Pistol", "weapon.shotgun": "Shotgun", "weapon.smg": "SMG", "weapon.rifle": "Assault Rifle", "weapon.lmg": "LMG",
    "weapon.sniper": "Sniper", "weapon.railgun": "Piercing Railgun", "weapon.grenadelauncher": "Grenade Launcher",
    "weapon.golden_smg": "Golden Vocabulary SMG", "weapon.school_wall": "Faculty Enforcer", "weapon.hospital_wall": "Trauma Cannon",
    "weapon.bunker_wall": "Vault Breaker", "weapon.hall_monitor": "Hallway Monitor", "weapon.detention_slug": "Detention Slugger",
    "weapon.pop_quiz": "Pop Quiz", "weapon.cafeteria_cleaver": "Cafeteria Cleaver", "weapon.honor_roll": "Honor Roll",
    "weapon.science_fair": "Science Fair", "weapon.art_attack": "Art Attack", "weapon.principals_verdict": "Principal's Verdict",
    "weapon.scrap_spitter": "Scrap Spitter", "weapon.nail_driver": "Nail Driver", "weapon.hall_sweeper": "Hall Sweeper",
    "weapon.chalk_burster": "Chalk Burster", "weapon.detention_deuce": "Detention Deuce", "weapon.rust_repeater": "Rust Repeater",
    "weapon.gym_grinder": "Gym Class Grinder", "weapon.copper_coil": "Copper Coil", "weapon.locker_lancer": "Locker Lancer",
    "weapon.bus_bulldog": "Bus Stop Bulldog", "weapon.thunder_chalk": "Thunder Chalk", "weapon.void_principal": "Void Principal",
    "weapon.prism_lance": "Prism Lance", "weapon.final_bell": "Final Bell", "weapon.meteor_detention": "Meteor Detention",
    "weapon.sterile_slug": "Sterile Slug", "weapon.rebound_pistol": "Rebound Pistol", "weapon.scalpel_smg": "Scalpel SMG",
    "weapon.triage_carbine": "Triage Carbine", "weapon.crash_cart": "Crash Cart", "weapon.iv_repeater": "IV Repeater",
    "weapon.bone_saw": "Bone Saw", "weapon.morphine_mist": "Morphine Mist", "weapon.quarantine_lance": "Quarantine Lance",
    "weapon.autoclave": "Autoclave", "weapon.defib_driver": "Defib Driver", "weapon.vital_sign": "Vital Sign",
    "weapon.code_blue": "Code Blue", "weapon.gauze_gun": "Gauze Gun", "weapon.syringe_spitter": "Syringe Spitter",
    "weapon.plaster_popper": "Plaster Popper", "weapon.oxygen_burst": "Oxygen Burst", "weapon.reflex_hammer": "Reflex Hammer",
    "weapon.dialysis_drum": "Dialysis Drum", "weapon.x_ray_beam": "X-Ray Beam", "weapon.anesthetic_arc": "Anesthetic Arc",
    "weapon.cardiac_coil": "Cardiac Coil", "weapon.plague_thrower": "Plague Thrower", "weapon.gene_splicer": "Gene Splicer",
    "weapon.flatline": "Flatline", "weapon.rebar_repeater": "Rebar Repeater", "weapon.breach_gauge": "Breach Gauge",
    "weapon.scrap_auto": "Scrap Auto", "weapon.service_rifle": "Service Rifle", "weapon.pipe_mortar": "Pipe Mortar",
    "weapon.vent_ripper": "Vent Ripper", "weapon.bolt_thrower": "Bolt Thrower", "weapon.siege_slug": "Siege Slug",
    "weapon.drum_hammer": "Drum Hammer", "weapon.capacitor_lance": "Capacitor Lance", "weapon.thermite_tube": "Thermite Tube",
    "weapon.overwatch": "Overwatch", "weapon.warhead": "Warhead", "weapon.nut_cracker": "Nut Cracker",
    "weapon.chain_feeder": "Chain Feeder", "weapon.blast_door": "Blast Door", "weapon.tri_burst": "Tri-Burst",
    "weapon.sledge_shot": "Sledge Shot", "weapon.rail_spike": "Rail Spike", "weapon.arc_welder": "Arc Welder",
    "weapon.mag_driver": "Mag Driver", "weapon.mortar_pup": "Mortar Pup", "weapon.reactor_core": "Reactor Core",
    "weapon.last_stand": "Last Stand", "weapon.doomsday": "Doomsday",
  },
};

G.T = function (key, vars) {
  const table = G.STRINGS[G.lang] || G.STRINGS.en;
  let s = table[key];
  if (s == null) s = G.STRINGS.en[key];
  if (s == null) { if (!G._missingKeys) G._missingKeys = {}; G._missingKeys[key] = true; return key; }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return s;
};

// fill the static page: data-i18n (text), data-i18n-html, data-i18n-aria
G.applyStaticStrings = function (root) {
  root = root || document;
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = G.T(el.getAttribute("data-i18n")); });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = G.T(el.getAttribute("data-i18n-html")); });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", G.T(el.getAttribute("data-i18n-aria"))); });
  document.documentElement.lang = G.lang;
};

// names and labels carried on game data, set from the table by id
G.localizeData = function () {
  (G.LEVELS || []).forEach((l) => { l.name = G.T("level." + l.id); });
  if (G.WEAPON_DEFS) Object.values(G.WEAPON_DEFS).forEach((d) => { d.name = G.T("weapon." + d.id); });
  if (G.MELEE_DEF) G.MELEE_DEF.name = G.T("weapon.melee");
  (G.ACHIEVEMENTS || []).forEach((a) => { a.name = G.T("ach." + a.id + ".name"); a.desc = G.T("ach." + a.id + ".desc"); });
  (G.SHOP_ITEMS || []).forEach((it) => { it.label = G.T("shopItem." + it.id); });
  if (G.RARITY) Object.values(G.RARITY).forEach((r) => { r.label = G.T("rarity." + r.key); });
  (G.WEIGHT_CLASSES || []).forEach((w) => { w.label = G.T("weight." + w.key); });
};

// Signs and posters are drawn on fixed-size canvases, and a translation can be
// longer than the text they were laid out for: shrink the font until it fits.
G.fitFont = function (ctx, text, px, maxW, family) {
  const f = (p) => `bold ${p}px ${family || "sans-serif"}`;
  ctx.font = f(px);
  while (px > 10 && ctx.measureText(text).width > maxW) ctx.font = f(--px);
  return px;
};

// before G.Game.init (registered earlier, so it runs first)
window.addEventListener("DOMContentLoaded", () => { G.localizeData(); G.applyStaticStrings(); });
