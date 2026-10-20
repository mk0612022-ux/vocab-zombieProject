# System Architecture — การปรับเปลี่ยนครั้งใหญ่ (รอบ 0)

เอกสารนี้สำรวจจากโค้ดจริง ณ commit `2dfc582` (2026-10-20) สถานะในตาราง:
**คง** = ใช้ของเดิมตามเดิม · **แก้** = ต่อยอด/ปรับของเดิม · **ใหม่** = สร้างไฟล์หรือระบบใหม่

## 1. ข้อเท็จจริงของโปรเจกต์

| เรื่อง | ค่าจริง |
|---|---|
| Three.js | **r128** โหลดจาก cdnjs (`index.html`) — API ต้องเป็นของ r128 เท่านั้น (เช่น `InstancedMesh.setColorAt` มี, `getColorAt` ไม่ใช้, ไม่มี `WebGLRenderer.outputColorSpace`) |
| โครงสร้างโค้ด | script ธรรมดา ~75 ไฟล์ใน `public/js/` ทุกไฟล์แขวนของบน `window.G` (เช่น `G.Game`, `G.Audio`) ไม่มี bundler ไม่มี module/import ลำดับโหลดตาม `<script defer>` ใน `public/index.html` |
| ข้อมูล | `public/js/data/` (word bank 3 ด่าน 886 คำ, confusables 18, notes, bosses) |
| Config | `js/config.js` (`G.CONFIG` + `G.WEAPON_DEFS` 85 กระบอก + `G.ZOMBIE_TYPES` + `G.WAVE_TABLE`) และ `js/visual-config.js` (`G.VISUAL` ภาพ/แสง/quality tier) |
| ข้อความ | `js/strings.js` (EN, `G.T(key, vars)`) + `strings-th/zh/fr.js` 1,699 key ครบ 4 ภาษา (`tools/check-strings.ps1`) |
| Save | `localStorage` key `vocabZombie_save_v1`, `G.normalizeSave` เติมฟิลด์ใหม่และซ่อมของผิดชนิด (การเปลี่ยนโครง save ต้องมี migration) |
| Deploy | Cloudflare Workers static assets: push `main` → deploy เฉพาะ `public/` (`wrangler.jsonc`) · `public/version.json` + `js/updater.js` + `sw.js` แจ้งอัปเดตและโหลดเฉพาะไฟล์ที่ hash เปลี่ยน |
| ทดสอบ | ไม่มี Node บนเครื่องนี้ → ทดสอบผ่าน `serve-lan.ps1` (localhost:8080) + headless Edge ผ่าน DevTools protocol, ชุดทดสอบ `tools/round1..20-test.js` (`G.RoundNTest.run()`) |

## 2. แผนที่ระบบเดิม (ไฟล์ → หน้าที่ → สิ่งที่จะทำในงานนี้)

### เกมเพลย์และอาวุธ
| ระบบ | ไฟล์ | หน้าที่ปัจจุบัน | งานนี้ |
|---|---|---|---|
| Game loop / state | `game.js` (`G.Game`: `state` = MENU/GAMEPLAY/PAUSE/…, `update(dt)`, `loop(t)`) | เวลา dt จาก rAF, หยุดเมื่อ pause/modal (`G.Modal.freezesWorld/pausesAll`) | **แก้**: เพิ่ม `G.Clock` (game time ที่หยุดเมื่อ pause) ให้ระบบอื่นอ่าน |
| ยิง | `game.js` `fireWeapon`, `raycastShoot`, `splashDamage`, `meleeAttack`, `recoilKick` | ยิงตรงจาก input, ลดกระสุน, เรียกเสียง/แสง/ปลอกกระสุนโดยตรง | **แก้**: ย้ายการตัดสินใจไปที่ WeaponStateMachine, ส่ง event `weapon:fire` แทนการเรียกตรง |
| รีโหลด | `game.js` `reload`, `onReloadEvent`, `cancelReload` + `viewmodel.js` `planReload` | timeline ต่ออาวุธ 6 แบบ (pistol/rifle/bolt/belt/launcher/shotgun), ammo เติมที่ event `in`/`shell` ตามเวลา gameplay (ไม่ขึ้นกับภาพ) | **แก้**: เพิ่ม tactical/empty, reloadId, commit fallback, ตารางยกเลิก (รอบ 1) |
| สลับอาวุธ | `game.js` `switchSlot`, `updateShooting`, `weaponAnim.switchT/pendingRebuild`, `loadout.js` | สลับทันทีใน state แล้ว viewmodel ทำท่าลด/ยก | **แก้**: ผ่าน state machine, จำช่องสุดท้ายที่ขอ |
| เล็ง / วิ่ง | `game.js` `updatePlayerMovement` (`aimT`, `_sprintLatch`, stamina) | เล็ง = **คลิกขวา**/LT/ปุ่ม touch, วิ่ง = Shift, sprint ทำให้ยิงไม่ได้จนลดปืน | **แก้**: sprint-out delay ตามน้ำหนัก, aim-after-reload |
| แอนิเมชันปืน | `viewmodel.js` (`G.ViewModel`), `anim.js` (`G.Anim.Spring`), `headbob.js`, `playerbody.js` (แขน IK) | pose blending hip/sprint/aim, spring sway/bob ล็อกกับจังหวะเท้า, reload keyframe, switch ลด/ยก | **แก้**: รับสถานะจาก state machine, เพิ่ม inspect/lowered/disabled/flinch, marker + instanceId |
| ตัวปืน | `entities.js` `G.WEAPON_ARCHETYPES` (10 แบบ), `G.buildWeaponMesh`, `G.weightClass` | voxel ประกอบเป็นชิ้น (parts: mag, bolt, pump, cover) + hand anchors | **แก้** (รอบ 2): วัสดุ/texture เล็ก, คงสีเอกลักษณ์ |
| Viewmodel render | `visuals.js` `render()` (gun drawn in depthRange 0–0.01, layer 1) | แยก pass แก้ z-fighting แล้ว | **คง** |
| VFX | `entities.js` `spawnMuzzleFlash` (แสงจาก pool เท่านั้น), `spawnShellEject` (สร้าง mesh ใหม่ทุกนัด + rAF), `spawnHitParticles` → `perf.js` `G.Perf.sparks/flash` (pool), `zombiefx.js` (pool ชิ้นส่วน/เลือด) | ไม่มี sprite แฟลช, ไม่มี decal รอยกระสุน, ไม่มี surfaceType | **แก้/ใหม่** (รอบ 2): `G.FX` pool กลาง, surfaceType กลาง |
| ซอมบี้ | `entities.js` `G.Zombie` (normal/fast/crawler + odd: deformed, headInHand, longArm, bigArm, ชุดตามด่าน), `zombiefx.js` (เกิด/ตาย), `aim.js` (hitbox หัว/ตัว/แขนขา), `systems.js` `G.Spawner`, `world.js` waypoint | 3 ชนิด + 4 ลักษณะแปลก | **ใหม่/แก้** (รอบ 4): ZombieFactory 10 ชนิด ต่อยอดจากรูปทรงเดิม |
| บอส | `bosses.js`, `bossmodels.js`, `bossmoves.js`, `cutscene.js` | 10 ตัว ชื่อ/พลัง/cutscene | **คง** พฤติกรรม, **แก้** รูปลักษณ์ (รอบ 4.7) |

### เสียง
| ระบบ | ไฟล์ | หน้าที่ปัจจุบัน | งานนี้ |
|---|---|---|---|
| Audio core | `audio.js` (`G.Audio`) | สังเคราะห์ทั้งหมด (ไม่มีไฟล์เสียง), bus: `sfx` `music` `ambient` + speech (SpeechSynthesis), master compressor, `_out(bus,pos)` PannerNode equalpower, voice guard รวม 64, ปลดล็อก iOS ทุก gesture | **แก้** (รอบ 3): bus Weapons/UI แยก, limiter, ducking, voice pool ต่อหมวด, captions |
| Gun audio | `gunaudio.js` (`G.GunAudio`) | 85 กระบอก เสียงไม่ซ้ำ (family + seed): transient/body/tail + mech, reload/draw, reverb ตามที่ยืน (room/corridor/outdoor ผ่าน ConvolverNode ต่อแบบ) | **แก้**: pre-render ด้วย OfflineAudioContext, variants, zone A/B crossfade |
| เสียงป่า/ฉาก | `audio.js` `startLevel`, `forestTick` | bed + one-shot ต่อ theme | **คง/แก้** |

### UI
| ระบบ | ไฟล์ | หน้าที่ปัจจุบัน | งานนี้ |
|---|---|---|---|
| Modal กลาง | `modal.js` (`G.Modal.open/close`, freeze/pause/keys) | = openModal/closeModal ของสเปก | **คง** ใช้ต่อทุกหน้าต่าง |
| HUD | `ui.js` `updateHud(p)` (อัปเดต DOM เมื่อค่าเปลี่ยน), `game.js` `buildHudState()`, `hudcfg.js` (ขนาด 50–150% ต่อส่วน), `touchcfg.js`, `minimap.js` | HUD มุมซ้าย/ขวาล่าง | **แก้** (รอบ 6): layout กลางล่าง |
| Loading / Start / Lobby | `boot.js`, `start.js` (Tap To Lobby), `lobby.js` (carousel + 10 ไอคอน) | Loading → Start → Lobby | **ใหม่** (รอบ 5): Main Menu 3D แทน Start, ย้ายไอคอน |
| หน้าเมนูย่อย | `settings.js`, `progress.js`, `vocabcard.js` (Word Log), `journal.js`, `bosscodex.js`, `customvocab.js`, ui.js (leaderboard/achievements/armory/help) | เปิดจากไอคอนลอบบี้ | **คง** เนื้อหา เปลี่ยนแค่ทางเข้า |
| คำถาม | `quiz.js` (6 ข้อท้ายเวฟ), `questions.js` (8 แบบ), `spell.js`, `learnmodes.js`, `study.js` (Daily Review), `practice.js`, `clues.js`, `distract.js`, `srs.js`, `game.js` `startWordChallenge` (บอส/ประตู/ชั้น), `abilityui.js` (รวงผึ้ง), `floor3.js` | ตอบแล้วแสดงผลถูก/ผิดสั้น ๆ | **แก้** (รอบ 7): คำอธิบายทุกจุด |

### ภาพ
`visuals.js` `post.js` `lightfx.js` `forest.js` `sky.js` `zones.js` `perf.js` (pool ไฟ dynamic คงที่, merge, zones) — **คง** (ชุดภาพ 3 รอบเพิ่งเสร็จ) ใช้ต่อ: ไฟวาบปากกระบอกยืม light pool (`G.Perf.flash`), ป้ายคำไม่โดน bloom/หมอก

## 3. Event Bus กลาง (ใหม่: `js/bus.js`, `G.Bus`)

ปัจจุบันไม่มี event bus — ทุกระบบเรียกกันตรง ๆ (`G.Audio.gunshot(def)`, `G.UI.showHitmarker()`, `G.ViewModel.cancelReload()`) งานนี้เพิ่ม bus เล็ก ๆ แบบ synchronous:

```js
G.Bus.on(type, fn, owner)     // คืน token; owner ใช้ off ทีเดียวทั้งชุดตอน dispose
G.Bus.off(tokenOrOwner)
G.Bus.emit(type, payload)     // payload: { id, instanceId, src, pos?, t (game time), ...ข้อมูล }
```

- **synchronous** (ผู้ฟังทำงานทันทีในเฟรมเดียวกัน) เพื่อให้เสียง/ภาพตรงเฟรมกับ gameplay
- ไม่สร้าง object ใหม่ในเส้นทางร้อน: payload ของ event ที่ถี่ (ยิง, ฝีเท้า) ใช้ object pool ต่อ type
- `id` เพิ่มทีละ 1 ต่อ emit (กันเล่นซ้ำ) · `instanceId` ผูกกับแอนิเมชันหรือเหตุการณ์ต่อเนื่อง (รีโหลดครั้งหนึ่ง = instanceId เดียว ทุก marker อ้างตัวเดียวกัน)
- dev mode (`?debug=1`): บันทึก 10 event ล่าสุดใน debug overlay, เตือน event ซ้ำ id เดิม
- ย้ายแบบค่อยเป็นค่อยไป: ทุกรอบเปลี่ยนเฉพาะระบบของรอบนั้น ระบบอื่นยังเรียกตรงได้จนถูกย้าย

### Event หลัก (ผู้ส่ง → ผู้รับ)

| Event | ผู้ส่ง (source of truth) | ผู้รับ |
|---|---|---|
| `weapon:state` {from, to, reason} | WeaponStateMachine | ViewModel, HUD, debug |
| `weapon:fire` {weaponId, family, shotId, rpm} | WSM (หลัง gameplay ลดกระสุนแล้ว) | ViewModel (kick), Audio (shot), FX (flash/smoke/shell), Camera (recoil), HUD (ammo) |
| `weapon:dryfire` | WSM | Audio, HUD |
| `weapon:reload` {phase: start/marker/commit/end/cancel, kind: tactical/empty/loop, reloadId, marker} | WSM (timeline gameplay) | ViewModel, Audio, HUD (แถบความคืบหน้า, ammo หลัง commit) |
| `weapon:switch` {phase: lower/raise/done, fromId, toId, slot} | WSM | ViewModel, Audio (holster/draw), HUD (ช่อง) |
| `weapon:aim` {on, weight} · `weapon:inspect` · `weapon:melee` {phase, hit} | WSM | ViewModel, Audio, UI |
| `hit:impact` {pos, normal, surface, kind: bullet/pellet/melee/blast} | raycast (game.js) | FX (impact/decal), Audio (impact) |
| `zombie:spawn/state/hurt/attack/die/special` {zid, type, pos, ...} | Zombie AI | Animation zombie, Audio, FX, HUD (ตัวนับ), captions |
| `player:hurt/heal/step/land/jump/die` {pos, surface} | game.js | Audio, Camera, HUD, ViewModel (flinch) |
| `zone:audio` {zone} | ระบบ zone (ตำแหน่งผู้เล่น) | Audio (reverb A/B) |
| `ui:open/close/hover/select/back` {panel} | Modal / เมนู | Audio (UI bus), ducking |
| `quiz:answer` {kind, right, chosen, target, reason} | ทุกระบบคำถาม | Explanation (รอบ 7), SRS/Progress (เดิม) |
| `game:pause/resume/levelStart/levelEnd/gameOver/wave` | game.js | ทุกระบบ (หยุด/ล้างเสียง/VFX, reset state) |

## 4. UI Data Flow (Game State → HUD / เมนู / popup)

```
input (keyboard/mouse/touch/pad) ──คำขอ──▶ WeaponStateMachine / game.js
                                                │ (gameplay เปลี่ยนค่าจริง: ammo, HP, stamina, money)
                                                ▼
                                   Game State (G.Game.player, wave, objectives…)
                                       │                         │
                       G.Bus events (ยิง รีโหลด โดนตี)    buildHudState() ทุกเฟรม
                                       │                         │
                       เสียง / ภาพ / VFX (ฟังอย่างเดียว)   G.UI.updateHud(p): เขียน DOM เฉพาะค่าที่เปลี่ยน
```

- HUD **อ่านอย่างเดียว** จาก snapshot `buildHudState()` (เดิม) — ไม่เก็บสำเนาที่อาจค้าง เมื่อ Game Over/เริ่มใหม่/เปลี่ยนด่าน snapshot ใหม่ทับทั้งหมด
- popup คำถามทุกแบบเปิดผ่าน `G.Modal` (freeze = โลกหยุดแต่ timer หน้าต่างเดิน, pause = หยุดทั้งหมด)
- เมนูหลัก/ลอบบี้อ่าน `G.save` (เดิม) และเขียนผ่านฟังก์ชันเดิม + `G.persist()`

### ความหมายบรรทัด HUD ใหม่ (รอบ 6) จากระบบเดิม
| บรรทัด | มาจาก |
|---|---|
| Savings 0$ | `player.money` (เงินในรอบเล่น) |
| ★ | `player.score` |
| แถบเลือด % | `player.hp / player.maxHp` (ปัดขึ้น, 0% เฉพาะตาย) |
| แถบ stamina | `G.Game.stamina / maxStamina`, หมดแรง = `staminaExhausted` |
| ช่อง Knife | ช่อง 0 (`currentSlot === 0`, `G.MELEE_DEF`) |
| ช่อง Pistol, Slot 2… | `player.gunSlots[i]` (เริ่ม 4 กระบอก + perk `extra_slot` ได้ถึง 6) — ช่องว่างจาก `G.Loadout.maxSlots()` |
| ชื่ออุปกรณ์ / สถานะเขียว | `def.name`, `G.weightClass(def).label` (LIGHT/MEDIUM/HEAVY/VERY HEAVY) |
| 12/48 | `player.ammo[id].mag / .reserve` |
| Mission 1/7 (เหลือง) | `G.Objectives.doneCount / list().length` (เดิมแสดง "ภารกิจ d/n") |
| Floor 3 (เหลือง) | ชั้นที่ยืน (`G.Zones.state.storey`) — ซ่อนในด่านที่ไม่มีหลายชั้น |
| 0/6 (ฟ้า) | ตัวนับของภารกิจปัจจุบัน (`G.Objectives` รายการที่ยังไม่เสร็จที่มี count) เช่น คะแนนชั้น 3 (`hud-floor3`) |
| แถบหัวกล่องคำถาม | Wave `wave/level.waves`, Zombies `zombiesLeft` (เดิม), Endless = เลขเวฟ, เวฟบอส = BOSS, ชื่อด่าน (ตัวเล็ก) |

## 5. เวลาเกม (Game Time)
- ใหม่: `G.Clock` — `t` (game time วินาที), `dt`, `paused`; เดินเฉพาะตอน `G.Game.state === "GAMEPLAY"` และไม่มี modal แบบ pause
- ระบบที่ตอนนี้ใช้ `performance.now()`/`requestAnimationFrame` เอง (ปลอกกระสุน, hit particle fallback, glance note, เอฟเฟกต์บางตัว) จะย้ายมาใช้ `G.Clock` ทีละรอบ
- เสียง: pause → `ctx` ของ Web Audio ยังเดิน แต่ bus Weapons/SFX/Ambient ถูก mute แบบ ramp และ one-shot ที่ผูก instanceId ถูก stop; UI bus ยังทำงาน (รอบ 3)

## 6. หน้า Lab และ debug
- `public/js/debug.js` และ `public/js/lab/*.js` (ใหม่) โหลดโดย `G.Game.init` เฉพาะเมื่อ URL มี `?debug=1` หรือ `?lab=` — ไม่โหลดตอนเล่นปกติ (ไม่มี `<script>` ใน index.html)
- ต้องอยู่ใน `public/` เพื่อให้ทดสอบบน iPad ผ่านเว็บจริงได้ (ของใน `tools/` ไม่ถูก deploy) — อยู่ใน `version.json` ด้วย (ไม่กี่ KB) จึงเปิดแบบ offline ได้ แต่ไม่ถูกโหลดเข้าเกมจนกว่าจะเรียก
- ต่อยอดของเดิม: `tools/gun-gallery.html` (ดูปืนทุกกระบอก), `tools/playtest-bot.js`, `tools/perf-measure.js`
