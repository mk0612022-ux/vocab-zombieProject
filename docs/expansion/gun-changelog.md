# Gun changelog

Made by tools/balance.ps1 from js/data/gunstats.js: do not edit by hand. Old: js/config.js, new: the sheet. `G.CONFIG.expansion.gunStats = false` brings the old ones back. Names, colours and sounds did not change.

76 values changed, on 53 of 85 guns.

| gun | rarity | field | old | new |
|---|---|---|---|---|
| school_wall | secret | damage | 20 | 16 |
| hospital_wall | secret | damage | 22 | 8 |
| bunker_wall | secret | damage | 140 | 125 |
| hall_monitor | rare | damage | 24 | 11 |
| hall_monitor | rare | fireRate | 110 | 100 |
| hall_monitor | rare | magSize | 35 | 40 |
| detention_slug | rare | damage | 18 | 12 |
| pop_quiz | epic | damage | 34 | 30 |
| pop_quiz | epic | fireRate | 200 | 215 |
| cafeteria_cleaver | epic | damage | 72 | 64 |
| honor_roll | epic | damage | 110 | 75 |
| science_fair | secret | damage | 45 | 16 |
| science_fair | secret | fireRate | 105 | 95 |
| science_fair | secret | magSize | 40 | 60 |
| science_fair | secret | reloadTime | 2000 | 1900 |
| art_attack | secret | damage | 120 | 78 |
| art_attack | secret | fireRate | 950 | 700 |
| principals_verdict | secret | damage | 150 | 96 |
| chalk_burster | uncommon | damage | 21 | 18 |
| chalk_burster | uncommon | reloadTime | 1700 | 1500 |
| detention_deuce | uncommon | damage | 19 | 14 |
| gym_grinder | rare | damage | 9 | 10 |
| thunder_chalk | epic | damage | 72 | 36 |
| void_principal | epic | damage | 44 | 16 |
| void_principal | epic | magSize | 40 | 50 |
| prism_lance | epic | damage | 95 | 54 |
| final_bell | secret | damage | 30 | 8 |
| meteor_detention | secret | damage | 165 | 125 |
| rebound_pistol | common | damage | 20 | 15 |
| rebound_pistol | common | reloadTime | 1000 | 900 |
| scalpel_smg | uncommon | damage | 12 | 11 |
| triage_carbine | uncommon | damage | 20 | 15 |
| iv_repeater | rare | damage | 22 | 11 |
| iv_repeater | rare | magSize | 40 | 50 |
| bone_saw | rare | damage | 16 | 9 |
| morphine_mist | epic | damage | 26 | 18 |
| quarantine_lance | epic | damage | 62 | 72 |
| quarantine_lance | epic | fireRate | 520 | 760 |
| autoclave | epic | damage | 80 | 64 |
| autoclave | epic | fireRate | 950 | 700 |
| code_blue | secret | damage | 50 | 16 |
| code_blue | secret | magSize | 45 | 60 |
| gauze_gun | common | damage | 12 | 11 |
| syringe_spitter | common | damage | 18 | 11 |
| oxygen_burst | uncommon | damage | 22 | 18 |
| dialysis_drum | uncommon | damage | 14 | 12 |
| plague_thrower | epic | damage | 88 | 58 |
| gene_splicer | epic | damage | 70 | 32 |
| rebar_repeater | common | damage | 22 | 12 |
| rebar_repeater | common | fireRate | 300 | 220 |
| breach_gauge | common | damage | 11 | 10 |
| scrap_auto | uncommon | damage | 13 | 11 |
| service_rifle | uncommon | damage | 24 | 14 |
| vent_ripper | rare | damage | 24 | 14 |
| siege_slug | epic | damage | 20 | 8 |
| siege_slug | epic | fireRate | 820 | 620 |
| drum_hammer | rare | damage | 18 | 12 |
| capacitor_lance | epic | damage | 52 | 42 |
| thermite_tube | epic | damage | 95 | 110 |
| thermite_tube | epic | fireRate | 1000 | 1150 |
| overwatch | secret | damage | 352 | 285 |
| overwatch | secret | pierce | - | 3 |
| warhead | secret | damage | 220 | 115 |
| warhead | secret | fireRate | 1400 | 850 |
| warhead | secret | magSize | 2 | 3 |
| nut_cracker | common | damage | 20 | 16 |
| nut_cracker | common | fireRate | 280 | 340 |
| blast_door | common | damage | 13 | 10 |
| blast_door | common | spread | 0.08 | 0.06 |
| tri_burst | uncommon | damage | 25 | 17 |
| tri_burst | uncommon | magSize | 27 | 21 |
| rail_spike | rare | damage | 62 | 58 |
| arc_welder | rare | damage | 44 | 38 |
| reactor_core | epic | damage | 78 | 44 |
| last_stand | epic | damage | 46 | 15 |
| doomsday | secret | damage | 260 | 215 |

## What changed for every gun

Before: one spread for all but shotguns (0.004), a head hit x2, no falloff, a bloom of none, four magazines. Now by class (a gun's niche leans on these: G.CONFIG.balance.niches).

| class | head x | spread hip / aimed | falloff: full to, gone by (m), least | bloom: a shot, most |
|---|---|---|---|---|
| pistol | 2 | 0.01 / 0.004 | 14, 32, x0.6 | 0.003, 0.016 |
| smg | 2 | 0.016 / 0.007 | 10, 24, x0.55 | 0.0012, 0.02 |
| rifle | 2.7 | 0.014 / 0.003 | 22, 46, x0.7 | 0.0016, 0.018 |
| lmg | 2 | 0.022 / 0.008 | 20, 42, x0.65 | 0.001, 0.024 |
| shotgun | 1.5 | its own spread / x0.8 | 5, 14, x0.35 | 0, 0 |
| sniper | 2.5 | 0.03 / 0.0006 | none | 0, 0 |
| antimateriel | 2.5 | 0.04 / 0.0004 | none | 0, 0 |
| beam | 2 | 0.012 / 0.002 | 30, 60, x0.8 | 0, 0 |
| energy | 2 | 0.01 / 0.003 | 24, 50, x0.75 | 0, 0 |
| launcher | 1 | 0.012 / 0.006 | none | 0, 0 |
