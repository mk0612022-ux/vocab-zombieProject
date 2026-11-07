// ===================================================================
// Each gun's own line of the stat sheet (expansion, round 3)
// -------------------------------------------------------------------
// Everything not here comes from its class (G.CONFIG.balance.classes) or
// from G.WEAPON_DEFS; js/gunstats.js puts the three together.
//   niche        what it is for, in a word or two: "niche.<tag>" in the
//                strings. No two of a (level, rarity) share one
//   cls          its class, where its archetype does not say
//   damage fireRate magSize reloadTime pierce spread pellets recoil
//                over G.WEAPON_DEFS (the old values: docs/expansion/gun-changelog.md)
//   headMult fall hip ads bloom reserveMags    over its class
//   reloadTactical adsTime sprintOut           over its weight's
// ===================================================================
window.G = window.G || {};

G.GUN_SHEET = {
  // ---- the school ----
  pistol: { niche: "sidearm" },
  shotgun: { niche: "room_clear" },
  smg: { niche: "nimble" },
  rifle: { niche: "all_round" },
  lmg: { niche: "suppress" },
  sniper: { niche: "one_tap" },
  railgun: { niche: "crowd_pierce" },
  grenadelauncher: { niche: "blast_area" },
  golden_smg: { niche: "close_spray" },
  school_wall: { niche: "fast_reload", damage: 16 },
  hall_monitor: { niche: "close_spray", damage: 11, fireRate: 100, magSize: 40 },
  detention_slug: { niche: "room_clear", damage: 12 },
  pop_quiz: { niche: "rapid_tap", damage: 30, fireRate: 215 },
  cafeteria_cleaver: { niche: "heavy_punch", damage: 64 },
  honor_roll: { niche: "headhunter", damage: 75 },
  science_fair: { niche: "nimble", damage: 16, fireRate: 95, magSize: 60, reloadTime: 1900 },
  art_attack: { niche: "blast_area", damage: 78, fireRate: 700 },
  principals_verdict: { niche: "crowd_pierce", damage: 96 },
  scrap_spitter: { niche: "close_spray" },
  nail_driver: { niche: "rapid_tap" },
  hall_sweeper: { niche: "wide_scatter" },
  chalk_burster: { niche: "burst_fire", damage: 18, reloadTime: 1500 },
  detention_deuce: { niche: "rapid_tap", damage: 14 },
  rust_repeater: { niche: "long_precise" },
  gym_grinder: { niche: "big_mag", damage: 10 },
  copper_coil: { niche: "charge_shot" },
  locker_lancer: { niche: "long_precise", cls: "sniper" },
  bus_bulldog: { niche: "heavy_punch" },
  thunder_chalk: { niche: "charge_shot", damage: 36 },
  void_principal: { niche: "long_precise", damage: 16, magSize: 50 },
  prism_lance: { niche: "boss_breaker", damage: 54 },
  final_bell: { niche: "room_clear", damage: 8 },
  meteor_detention: { niche: "boss_breaker", damage: 125 },

  // ---- the hospital ----
  hospital_wall: { niche: "room_clear", damage: 8 },
  sterile_slug: { niche: "room_clear" },
  rebound_pistol: { niche: "fast_reload", damage: 15, reloadTime: 900 },
  scalpel_smg: { niche: "nimble", damage: 11 },
  triage_carbine: { niche: "burst_fire", damage: 15 },
  crash_cart: { niche: "blast_area" },
  iv_repeater: { niche: "big_mag", damage: 11, magSize: 50 },
  bone_saw: { niche: "tight_choke", damage: 9 },
  morphine_mist: { niche: "rapid_tap", damage: 18 },
  quarantine_lance: { niche: "crowd_pierce", damage: 72, fireRate: 760 },
  autoclave: { niche: "heavy_punch", damage: 64, fireRate: 700 },
  defib_driver: { niche: "charge_shot" },
  vital_sign: { niche: "one_tap" },
  code_blue: { niche: "suppress", damage: 16, magSize: 60 },
  gauze_gun: { niche: "close_spray", damage: 11 },
  syringe_spitter: { niche: "rapid_tap", damage: 11 },
  plaster_popper: { niche: "wide_scatter" },
  oxygen_burst: { niche: "headhunter", damage: 18 },
  reflex_hammer: { niche: "heavy_punch", cls: "sniper", hip: 0.012, ads: 0.003, bloom: [0.004, 0.012, 0.05] },
  dialysis_drum: { niche: "suppress", damage: 12 },
  x_ray_beam: { niche: "headhunter" },
  anesthetic_arc: { niche: "charge_shot" },
  cardiac_coil: { niche: "long_precise" },
  plague_thrower: { niche: "big_mag", damage: 58 },
  gene_splicer: { niche: "charge_shot", damage: 32 },
  flatline: { niche: "crowd_pierce", cls: "antimateriel" },

  // ---- the bunker ----
  bunker_wall: { niche: "heavy_punch", damage: 125 },
  rebar_repeater: { niche: "rapid_tap", damage: 12, fireRate: 220 },
  breach_gauge: { niche: "room_clear", damage: 10 },
  scrap_auto: { niche: "close_spray", damage: 11 },
  service_rifle: { niche: "burst_fire", damage: 14 },
  pipe_mortar: { niche: "blast_area" },
  vent_ripper: { niche: "suppress", damage: 14 },
  bolt_thrower: { niche: "crowd_pierce" },
  siege_slug: { niche: "tight_choke", damage: 8, fireRate: 620 },
  drum_hammer: { niche: "big_mag", damage: 12 },
  capacitor_lance: { niche: "charge_shot", damage: 42 },
  thermite_tube: { niche: "heavy_punch", damage: 110, fireRate: 1150 },
  overwatch: { niche: "boss_breaker", cls: "antimateriel", damage: 285, pierce: 3 },
  warhead: { niche: "blast_area", damage: 115, fireRate: 850, magSize: 3 },
  nut_cracker: { niche: "heavy_punch", damage: 16, fireRate: 340 },
  chain_feeder: { niche: "suppress" },
  blast_door: { niche: "tight_choke", damage: 10, spread: 0.06 },
  tri_burst: { niche: "headhunter", damage: 17, magSize: 21 },
  sledge_shot: { niche: "heavy_punch" },
  rail_spike: { niche: "long_precise", damage: 58 },
  arc_welder: { niche: "charge_shot", damage: 38 },
  mag_driver: { niche: "one_tap" },
  mortar_pup: { niche: "nimble" },
  reactor_core: { niche: "boss_breaker", damage: 44 },
  last_stand: { niche: "suppress", damage: 15 },
  doomsday: { niche: "one_tap", damage: 215 },
};
