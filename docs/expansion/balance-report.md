# Balance report

Made by tools/balance.ps1 from the game's own data: do not edit by hand.

Zombie health by wave (G.CONFIG.zombies.hpByWave): perWave 0.08, OFF in the game for now: every wave plays as wave 1. Waves 1/5/10/15/20 read x1 x1.32 x1.72 x2.12 x2.52.
The columns w1-w20 are the planned curve. T3 w20: a Tier III gun (x1.9) at wave 20, to set beside w5.

## Flags

### Explained: 8

| kind | gun | what | why |
|---|---|---|---|
| stk-body | golden_smg | 1 to the body, 4-6 for a smg | the 1% jackpot: one body shot, on purpose |
| stk-head | golden_smg | 1 to the head, 2-3 for a smg | the 1% jackpot: one body shot, on purpose |
| budget | golden_smg | score 7.741, secret allows 1.6 | the 1% jackpot: kept at its old numbers, the one gun outside the budget |
| distinct | pistol | detention_deuce is 0.078 away in level 1 | the starting pistol, in every level; this one fires two-round bursts |
| distinct | pistol | rebound_pistol is 0.102 away in level 2 | the starting pistol, in every level; this one reloads in 0.9 s and has 2 rounds more |
| distinct | pistol | syringe_spitter is 0.139 away in level 2 | the starting pistol, in every level; this one fires twice as fast for less a round |
| distinct | pistol | rebar_repeater is 0.094 away in level 3 | the starting pistol, in every level; this one fires faster for less a round |
| distinct | pistol | nut_cracker is 0.141 away in level 3 | the starting pistol, in every level; this one hits harder, slower |

## Classes

| class | guns | body | head | sustained x1.00 | head x | falloff (m) |
|---|---|---|---|---|---|---|
| pistol | 6 | 3-4 | 1-2 | 52 | 2 | 14-32-0.6 |
| smg | 8 | 4-6 | 2-3 | 78 | 2 | 10-24-0.55 |
| rifle | 10 | 2-3 | 1-1 | 82 | 2.7 | 22-46-0.7 |
| lmg | 11 | 3-4 | 1-2 | 92 | 2 | 20-42-0.65 |
| shotgun | 11 | 1-1 (mid 2-3) | 1-1 | 58 | 1.5 | 5-14-0.35 |
| sniper | 11 | 1-2 | 1-1 | 70 | 2.5 | 60-60-1 |
| antimateriel | 2 | 1-1 | 1-1 | 75 | 2.5 | 60-60-1 |
| beam | 8 | 1-2 | 1-1 | 58 | 2 | 30-60-0.8 |
| energy | 7 | 1-2 | 1-1 | 75 | 2 | 24-50-0.75 |
| launcher | 11 | 1-1 | 1-1 | 44 | 1 | 60-60-1 |

## pistol

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pistol | 0 | common | sidearm | 14 | 188 | 12 | 1 | 44 | 35 | 0.694 | 1 | 3 | 2 | 0.64 | 3 | 4 | 5 | 6 | 7 | 4 |
| nut_cracker | 3 | common | heavy_punch | 16 | 176 | 12 | 1.1 | 47 | 37 | 0.711 | 1 | 3 | 2 | 0.68 | 3 | 3 | 4 | 5 | 6 | 3 |
| rebar_repeater | 3 | common | rapid_tap | 12 | 273 | 14 | 1.1 | 55 | 40 | 0.76 | 1 | 3 | 2 | 0.44 | 3 | 4 | 5 | 7 | 8 | 4 |
| rebound_pistol | 2 | common | fast_reload | 15 | 207 | 14 | 0.9 | 52 | 42 | 0.832 | 1 | 3 | 2 | 0.58 | 3 | 3 | 4 | 5 | 6 | 4 |
| syringe_spitter | 2 | common | rapid_tap | 11 | 375 | 20 | 1.3 | 69 | 49 | 0.929 | 1 | 4 | 2 | 0.48 | 4 | 5 | 6 | 7 | 8 | 5 |
| detention_deuce | 1 | uncommon | rapid_tap | 14 b2 | 353 | 16 | 1.2 | 82 | 57 | 1.084 | 1.1 | 3 | 2 | 0.34 | 3 | 4 | 5 | 6 | 7 | 4 |

## smg

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| scrap_spitter | 1 | common | close_spray | 7 | 1154 | 44 | 1.6 | 135 | 79 | 1.007 | 1 | 5 | 3 | 0.21 | 5 | 7 | 9 | 11 | 13 | 7 |
| gauze_gun | 2 | common | close_spray | 11 | 667 | 30 | 1.5 | 122 | 79 | 1.01 | 1 | 4 | 2 | 0.27 | 4 | 5 | 6 | 7 | 8 | 5 |
| smg | 1 | uncommon | nimble | 10 | 545 | 30 | 1.3 | 91 | 65 | 0.878 | 1.1 | 4 | 2 | 0.33 | 4 | 5 | 6 | 8 | 9 | 5 |
| scalpel_smg | 2 | uncommon | nimble | 11 | 600 | 32 | 1.3 | 110 | 78 | 1.053 | 1.1 | 4 | 2 | 0.3 | 4 | 5 | 6 | 7 | 8 | 5 |
| scrap_auto | 3 | uncommon | close_spray | 11 | 632 | 35 | 1.4 | 116 | 81 | 1.038 | 1.1 | 4 | 2 | 0.29 | 4 | 5 | 6 | 7 | 8 | 5 |
| hall_monitor | 1 | rare | close_spray | 11 | 600 | 40 | 1.4 | 110 | 81 | 1.038 | 1.2 | 4 | 2 | 0.3 | 4 | 5 | 6 | 7 | 8 | 5 |
| iv_repeater | 2 | rare | big_mag | 11 | 632 | 50 | 1.5 | 116 | 88 | 1.162 | 1.2 | 4 | 2 | 0.29 | 4 | 5 | 6 | 7 | 8 | 5 |
| golden_smg | 1 | secret | close_spray | 55 | 857 | 50 | 1 | 786 | 611 | 7.741 | 1.6 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |

## rifle

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nail_driver | 1 | common | rapid_tap | 16 | 400 | 24 | 1.4 | 107 | 77 | 0.924 | 1 | 3 | 1 | 0.3 | 3 | 3 | 4 | 5 | 6 | 3 |
| rust_repeater | 1 | uncommon | long_precise | 28 | 143 | 10 | 1.5 | 67 | 49 | 0.648 | 1.1 | 2 | 1 | 0.42 | 2 | 2 | 3 | 3 | 4 | 2 |
| rifle | 1 | uncommon | all_round | 18 | 375 | 25 | 1.5 | 113 | 82 | 1.014 | 1.1 | 2 | 1 | 0.16 | 2 | 3 | 4 | 5 | 5 | 3 |
| triage_carbine | 2 | uncommon | burst_fire | 15 b3 | 529 | 24 | 1.4 | 132 | 87 | 1.083 | 1.1 | 3 | 1 | 0.12 | 3 | 3 | 4 | 5 | 6 | 4 |
| service_rifle | 3 | uncommon | burst_fire | 14 b3 | 545 | 30 | 1.5 | 127 | 87 | 1.061 | 1.1 | 3 | 1 | 0.12 | 3 | 4 | 5 | 6 | 7 | 4 |
| tri_burst | 3 | uncommon | headhunter | 17 b3 | 514 | 21 | 1.5 | 146 | 90 | 1.097 | 1.1 | 2 | 1 | 0.06 | 2 | 3 | 4 | 5 | 6 | 3 |
| oxygen_burst | 2 | uncommon | headhunter | 18 b3 | 500 | 21 | 1.6 | 150 | 92 | 1.12 | 1.1 | 2 | 1 | 0.06 | 2 | 3 | 4 | 5 | 5 | 3 |
| chalk_burster | 1 | uncommon | burst_fire | 18 b3 | 529 | 21 | 1.5 | 159 | 97 | 1.183 | 1.1 | 2 | 1 | 0.06 | 2 | 3 | 4 | 5 | 5 | 3 |
| pop_quiz | 1 | epic | rapid_tap | 30 | 279 | 24 | 1.6 | 140 | 107 | 1.261 | 1.32 | 2 | 1 | 0.22 | 2 | 2 | 2 | 3 | 3 | 2 |
| morphine_mist | 2 | epic | rapid_tap | 18 b4 | 571 | 28 | 1.6 | 171 | 111 | 1.297 | 1.32 | 2 | 1 | 0.06 | 2 | 3 | 4 | 5 | 5 | 3 |

## lmg

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| chain_feeder | 3 | common | suppress | 11 | 800 | 40 | 2.4 | 147 | 81 | 0.881 | 1 | 4 | 2 | 0.22 | 4 | 5 | 6 | 7 | 8 | 5 |
| dialysis_drum | 2 | uncommon | suppress | 12 | 857 | 55 | 2.6 | 171 | 102 | 1.106 | 1.1 | 3 | 2 | 0.14 | 3 | 4 | 5 | 7 | 8 | 4 |
| gym_grinder | 1 | rare | big_mag | 10 | 1091 | 60 | 3 | 182 | 95 | 0.981 | 1.2 | 4 | 2 | 0.17 | 4 | 5 | 6 | 8 | 9 | 5 |
| vent_ripper | 3 | rare | suppress | 14 | 706 | 45 | 1.7 | 165 | 114 | 1.258 | 1.2 | 3 | 2 | 0.17 | 3 | 4 | 5 | 6 | 7 | 4 |
| drum_hammer | 3 | rare | big_mag | 12 | 923 | 70 | 2.8 | 185 | 114 | 1.18 | 1.2 | 3 | 2 | 0.13 | 3 | 4 | 5 | 7 | 8 | 4 |
| lmg | 1 | rare | suppress | 15 | 667 | 60 | 2.2 | 167 | 118 | 1.288 | 1.2 | 3 | 2 | 0.18 | 3 | 3 | 4 | 5 | 6 | 4 |
| void_principal | 1 | epic | long_precise | 16 | 600 | 50 | 2.1 | 160 | 113 | 1.302 | 1.32 | 3 | 2 | 0.2 | 3 | 3 | 4 | 5 | 6 | 3 |
| last_stand | 3 | epic | suppress | 15 | 750 | 60 | 2.5 | 188 | 123 | 1.31 | 1.32 | 3 | 2 | 0.16 | 3 | 3 | 4 | 5 | 6 | 4 |
| science_fair | 1 | secret | nimble | 16 | 632 | 60 | 1.9 | 168 | 126 | 1.379 | 1.6 | 3 | 2 | 0.19 | 3 | 3 | 4 | 5 | 6 | 3 |
| school_wall | 1 | secret | fast_reload | 16 | 667 | 45 | 1.5 | 178 | 130 | 1.46 | 1.6 | 3 | 2 | 0.18 | 3 | 3 | 4 | 5 | 6 | 3 |
| code_blue | 2 | secret | suppress | 16 | 667 | 60 | 2 | 178 | 130 | 1.426 | 1.6 | 3 | 2 | 0.18 | 3 | 3 | 4 | 5 | 6 | 3 |

## shotgun

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| plaster_popper | 2 | common | wide_scatter | 11x5 | 81 | 6 | 1.9 | 74 | 52 | 0.842 | 1 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |
| blast_door | 3 | common | tight_choke | 10x6 | 75 | 5 | 1.8 | 75 | 52 | 0.924 | 1 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| shotgun | 1 | common | room_clear | 9x6 | 80 | 6 | 1.6 | 72 | 53 | 0.921 | 1 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |
| hall_sweeper | 1 | common | wide_scatter | 12x5 | 83 | 6 | 2 | 83 | 57 | 0.958 | 1 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |
| sterile_slug | 2 | common | room_clear | 10x6 | 83 | 6 | 1.6 | 83 | 61 | 1.037 | 1 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| breach_gauge | 3 | common | room_clear | 10x7 | 77 | 5 | 1.7 | 90 | 62 | 1.038 | 1 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| bone_saw | 2 | rare | tight_choke | 9x7 | 86 | 8 | 1.8 | 90 | 68 | 1.229 | 1.2 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| detention_slug | 1 | rare | room_clear | 12x6 | 77 | 8 | 1.9 | 92 | 71 | 1.223 | 1.2 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| siege_slug | 3 | epic | tight_choke | 8x8 | 97 | 6 | 2 | 103 | 67 | 1.193 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| hospital_wall | 2 | secret | room_clear | 8x8 | 120 | 10 | 1.8 | 128 | 94 | 1.624 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| final_bell | 1 | secret | room_clear | 8x8 | 143 | 10 | 2.4 | 152 | 97 | 1.611 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |

## sniper

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sledge_shot | 3 | uncommon | heavy_punch | 40 | 125 | 8 | 1.6 | 83 | 59 | 0.891 | 1.1 | 1 | 1 | 0 | 1 | 2 | 2 | 2 | 3 | 2 |
| reflex_hammer | 2 | uncommon | heavy_punch | 34 | 140 | 10 | 1.4 | 79 | 60 | 0.856 | 1.1 | 1 | 1 | 0 | 1 | 2 | 2 | 3 | 3 | 2 |
| bus_bulldog | 1 | rare | heavy_punch | 58 | 92 | 6 | 2.1 | 89 | 58 | 0.846 | 1.2 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |
| locker_lancer | 1 | rare | long_precise | 50 | 115 | 12 | 1.8 | 96 | 75 | 1.115 | 1.2 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |
| sniper | 1 | rare | one_tap | 142 | 40 | 5 | 1.8 | 95 | 76 | 1.06 | 1.2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| cardiac_coil | 2 | rare | long_precise | 110 | 63 | 5 | 1.8 | 116 | 84 | 1.185 | 1.2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| mag_driver | 3 | rare | one_tap | 125 | 61 | 5 | 1.9 | 128 | 92 | 1.273 | 1.2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| cafeteria_cleaver | 1 | epic | heavy_punch | 64 | 115 | 8 | 1.7 | 123 | 87 | 1.281 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| honor_roll | 1 | epic | headhunter | 75 | 97 | 10 | 1.8 | 121 | 94 | 1.315 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 2 | 1 |
| bunker_wall | 3 | secret | heavy_punch | 125 | 80 | 6 | 2 | 167 | 115 | 1.637 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| vital_sign | 2 | secret | one_tap | 165 | 60 | 5 | 1.9 | 165 | 120 | 1.643 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |

## antimateriel

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| flatline | 2 | secret | crowd_pierce | 240 | 50 | 3 | 2.4 | 200 | 120 | 1.663 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| overwatch | 3 | secret | boss_breaker | 285 | 32 | 4 | 2 | 154 | 121 | 1.622 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |

## beam

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| x_ray_beam | 2 | rare | headhunter | 52 | 107 | 9 | 1.8 | 93 | 68 | 1.204 | 1.2 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |
| rail_spike | 3 | rare | long_precise | 58 | 100 | 8 | 1.9 | 97 | 69 | 1.247 | 1.2 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |
| bolt_thrower | 3 | rare | crowd_pierce | 58 | 107 | 8 | 1.7 | 104 | 75 | 1.315 | 1.2 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |
| railgun | 1 | epic | crowd_pierce | 45 | 120 | 8 | 1.7 | 90 | 63 | 1.219 | 1.32 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 2 |
| prism_lance | 1 | epic | boss_breaker | 54 | 125 | 8 | 1.8 | 113 | 77 | 1.443 | 1.32 | 1 | 1 | 0 | 1 | 1 | 2 | 2 | 2 | 1 |
| quarantine_lance | 2 | epic | crowd_pierce | 72 | 79 | 10 | 1.8 | 95 | 77 | 1.35 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| gene_splicer | 2 | epic | charge_shot | 32 | 94 | 10 | 2 | 101 | 78 | 1.343 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 2 | 2 | 1 |
| principals_verdict | 1 | secret | crowd_pierce | 96 | 86 | 6 | 2 | 137 | 93 | 1.701 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |

## energy

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| copper_coil | 1 | rare | charge_shot | 44 | 67 | 5 | 1.9 | 127 | 89 | 1.189 | 1.2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| anesthetic_arc | 2 | rare | charge_shot | 40 | 86 | 8 | 1.9 | 124 | 98 | 1.308 | 1.2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| arc_welder | 3 | rare | charge_shot | 38 | 88 | 9 | 1.8 | 121 | 98 | 1.312 | 1.2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| thunder_chalk | 1 | epic | charge_shot | 36 | 125 | 18 | 2 | 115 | 100 | 1.296 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| reactor_core | 3 | epic | boss_breaker | 44 | 67 | 6 | 2.3 | 132 | 100 | 1.284 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| capacitor_lance | 3 | epic | charge_shot | 42 | 94 | 9 | 1.9 | 126 | 104 | 1.386 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| defib_driver | 2 | secret | charge_shot | 46 | 120 | 12 | 2 | 147 | 126 | 1.674 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |

## launcher

| gun | lv | rarity | niche | dmg | rpm | mag | rl s | DPS | sust. | score | allowed | body | head | TTK s | w1 | w5 | w10 | w15 | w20 | T3 w20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mortar_pup | 3 | rare | nimble | 66 | 68 | 5 | 2 | 75 | 52 | 1.227 | 1.2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| grenadelauncher | 1 | epic | blast_area | 70 | 67 | 4 | 2 | 78 | 50 | 1.17 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| crash_cart | 2 | epic | blast_area | 72 | 67 | 4 | 2 | 80 | 51 | 1.193 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| autoclave | 2 | epic | heavy_punch | 64 | 86 | 5 | 2.2 | 91 | 56 | 1.288 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| pipe_mortar | 3 | epic | blast_area | 84 | 63 | 4 | 2.1 | 88 | 57 | 1.331 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| plague_thrower | 2 | epic | big_mag | 58 | 86 | 8 | 2.1 | 83 | 60 | 1.35 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| thermite_tube | 3 | epic | heavy_punch | 110 | 52 | 4 | 2.3 | 96 | 64 | 1.438 | 1.32 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| warhead | 3 | secret | blast_area | 115 | 71 | 3 | 2.8 | 135 | 64 | 1.439 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| art_attack | 1 | secret | blast_area | 78 | 86 | 5 | 2.3 | 111 | 67 | 1.521 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| meteor_detention | 1 | secret | boss_breaker | 125 | 55 | 4 | 2.6 | 114 | 71 | 1.6 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| doomsday | 3 | secret | one_tap | 215 | 40 | 2 | 3 | 143 | 72 | 1.628 | 1.6 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |

## Boss fights

Seconds to bring a boss of level 1 down: the middle gun of a rarity, 60% of its shots landing, with that many Damage upgrades.

| boss | health | upgrades | wanted (s) | common | uncommon | rare | epic | secret |
|---|---|---|---|---|---|---|---|---|
| wave 5 | 6000 | 1 | 90-120 | 164 | 107 | 105 | 112 | 76 |
| wave 10 | 11000 | 2 | 120-150 | 262 | 170 | 168 | 179 | 121 |
| wave 15 | 22000 | 4 | 150-180 | 396 | 257 | 254 | 271 | 182 |
| wave 20 | 32000 | 6 | 180-240 | 435 | 283 | 279 | 298 | 200 |


The same fights with the old numbers (before the sheet):

| boss | health | upgrades | wanted (s) | common | uncommon | rare | epic | secret |
|---|---|---|---|---|---|---|---|---|
| wave 5 | 6000 | 1 | 90-120 | 143 | 96 | 96 | 68 | 67 |
| wave 10 | 11000 | 2 | 120-150 | 228 | 153 | 153 | 108 | 107 |
| wave 15 | 22000 | 4 | 150-180 | 345 | 231 | 231 | 164 | 162 |
| wave 20 | 32000 | 6 | 180-240 | 379 | 254 | 254 | 180 | 178 |

## Melee

G.MELEE_WEAPONS and G.CONFIG.melee. Times in ms: wind-up / edge moving / back to ready. Blows: to the body, at full stamina.

| weapon | lv | price | move | times | swing | reach m | targets | stagger | stamina | dmg | head x | charged | DPS | TTK s | normal | fast | crawler | bloater | ironclad | runt | abomination | screamer | headless | reacher |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| knife | 0 | 0 | stab | 80/60/180 | 320 | 1.6 | 1 | light | 5 | 25 | 2 | - | 78 | 0.46 | 2 | 1 | 2 | 3 | 2 | 1 | 5 | 2 | 2 | 3 |
| bat | 1 | 900 | sweep | 180/90/320 | 590 | 2.1 | 3 | heavy | 12 | 42 | 1.25 | 76 | 71 | 0.27 | 1 | 1 | 1 | 2 | 2 | 1 | 3 | 1 | 1 | 2 |
| machete | 1 | 1100 | slash | 140/80/260 | 480 | 1.9 | 2 | medium | 9 | 34 | 1.5 | - | 71 | 0.22 | 1 | 1 | 1 | 2 | 2 | 1 | 3 | 1 | 1 | 2 |
| axe | 2 | 1800 | chop | 260/100/420 | 780 | 2.2 | 1 | very_heavy | 18 | 78 | 1.5 | 140 | 100 | 0.36 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1 |
| crowbar | 2 | 1300 | hook | 170/80/300 | 550 | 2 | 2 | heavy | 11 | 40 | 1.5 | - | 73 | 0.25 | 1 | 1 | 1 | 2 | 2 | 1 | 3 | 1 | 1 | 2 |
| shovel | 3 | 1400 | scoop | 200/90/340 | 630 | 2 | 2 | heavy | 13 | 42 | 1.25 | 76 | 67 | 0.29 | 1 | 1 | 1 | 2 | 2 | 1 | 3 | 1 | 1 | 2 |
