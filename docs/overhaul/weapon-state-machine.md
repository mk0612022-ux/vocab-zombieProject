# Weapon State Machine + Animation State (ออกแบบรอบ 0 · ลงมือรอบ 1)

## 1. ของเดิมที่มีอยู่ (สำรวจจากโค้ด ณ `2dfc582`)

ตอนนี้ไม่มี state machine ตัวเดียว สถานะปืนกระจายอยู่หลายตัวแปร:

| ตัวแปร / ฟังก์ชัน | ที่อยู่ | ความหมาย |
|---|---|---|
| `player.reloading`, `reloadState {id, plan, t, next}` | `game.js` `reload()` | รีโหลดอยู่ + timeline ของ `G.ViewModel.planReload(def, missing)` |
| `onReloadEvent(kind, R)` | `game.js` | event ของ timeline: `in` = เติมแม็กทั้งหมด, `shell` = เติม 1 นัด (ทำงานตามเวลา gameplay ไม่ขึ้นกับภาพ ✔ ตรงกับสเปกแล้ว) |
| `updateShooting(dt)` | `game.js` | เดิน timeline × Quick Hands, ตรวจการสลับปืน (`_lastWeaponId`), ตั้ง `weaponAnim.switchT/switchDur/pendingRebuild`, เรียก `G.GunAudio.swap` |
| `weaponAnim {switchT, switchDur, pendingRebuild, recoilPos, recoilRot}` | `game.js` | ลด/ยกปืน + spring ของ recoil |
| `player.fireCooldown`, `_burst`, `_chargeT`, `_fireEdge` | `game.js` | จังหวะยิง, ยิงชุด, ชาร์จ |
| `aimT` (0..1, ความเร็วคงที่ 10/วินาที) | `game.js` `updatePlayerMovement` | เล็ง = **คลิกขวา** (`G.Input.aimDown`) / LT / ปุ่ม ADS บน touch — ตอนนี้เล็งได้ระหว่างรีโหลดและวิ่ง |
| `_sprintLatch`, `G.ViewModel.S.sprintW > 0.25` | `game.js` | วิ่งทำให้ยิงไม่ได้จนท่าวิ่งลดลง (ไม่ใช่ delay ตามน้ำหนัก) |
| `G.SpellReload` | `spell.js` | Spell to Reload (เปิด modal แทน timeline) |
| `meleeAttack(def)` | `game.js` | มีด = ช่อง 0 ยิงด้วยปุ่มยิง โดนทันที (ไม่มี hit frame) **ไม่มี quick-melee** |
| `G.ViewModel` | `viewmodel.js` | pose hip/sprint/aim, spring sway/bob ตามเท้า (`G.PlayerBody.gait`), `SPRINT`/`FEEL` ต่อน้ำหนัก, `STYLES` (pistol/rifle/bolt/belt/launcher) + `SHELL` |

พฤติกรรมยกเลิกรีโหลดของเดิม: สลับปืน = ยกเลิก · กดวิ่ง "ใหม่" = ยกเลิก · ยิงปืนลูกซองที่มีกระสุนในแม็กแล้ว = ยกเลิก · teleport (เข้าบอส) = ยกเลิก · ไม่มี tactical/empty, ไม่มี inspect, ไม่มี watchdog, ไม่มี instanceId

## 2. โครงสร้างใหม่

ไฟล์ใหม่ `public/js/weaponsm.js` (`G.WeaponSM`) — **ตรรกะล้วน ไม่แตะ THREE/DOM/Audio** เพื่อให้ unit test และ fuzz test รันได้ทั้งในเบราว์เซอร์และใน Node (`module.exports` เมื่อไม่มี `window`)

```
Input / game.js ──requestX()──▶ G.WeaponSM ──เรียก hook gameplay──▶ game.js (ลดกระสุน, raycast, เติมแม็ก)
                                    │
                                    └──G.Bus.emit("weapon:*")──▶ ViewModel · Audio · FX · HUD · Camera (ฟังอย่างเดียว)
```

- คำขอ (ที่ทำจริงในรอบ 1): `requestFire({pressed, held, auto, charge})`, `prepareFire()` (ปืนชาร์จ), `burstRound(charge)`, `requestReload()` → `true` / `"full"` / `false`, `requestSwitch()` (หลัง game.js เปลี่ยน `player.currentSlot`), `requestInspect()`, `input({moving, sprinting, aimHeld, fireHeld})` ทุกเฟรม, `setLowered(reason, on, secs)`, `setDisabled(reason, on)`, `tick(dt)` ทุกเฟรม (นาฬิกา: รีโหลด สลับ inspect มีด คิวยิง watchdog)
- มีดใช้ `requestFire` เหมือนปืน (ช่อง 0) — ไม่มี quick-melee ในเกมเดิม
- Host ที่ game.js ให้ (`G.Game.weaponHost()`, gameplay = source of truth): `selected()`, `ammo(id)`, `weight(id)`, `family(id)`, `cooldownReady()`, `fireInterval(id)`, `doFire(shotId, charge, inBurst)` → `G.Game.shoot()`, `dryFire()`, `startMelee()`, `doMelee()` → `meleeAttack()`, `planReload(id, kind, missing)` → `G.ViewModel.planReload`, `commitReload(reloadId, id, "full"|1)`, `reloadSpeed()` (Quick Hands), `spellReload(id)` / `spellBusy()`, `switchDur(from, to)`, `swapModel()`, `stopSprint()`, `autoReload()`, `emit()` → `G.Bus`, `warn()` → debug overlay
- ฟิลด์เดิมที่โค้ดเก่าและชุดทดสอบอ่าน ยังใช้ได้โดยอ่านจาก state machine: `player.reloading`, `G.Game.reloadState`, `weaponAnim.switchT / switchDur / pendingRebuild` (ตั้ง `reloading = false` / `reloadState = null` = ยกเลิกรีโหลด, ตั้ง `switchT = 0` = จบการสลับทันที)
- state machine **ไม่เก็บกระสุนเอง** — อ่านจาก `player.ammo` ทุกครั้ง
- ค่าทั้งหมดใน `G.CONFIG.weaponSM` (config.js)

## 3. ตระกูลอาวุธ (data-driven) — แผนที่จาก archetype เดิม

| ตระกูลในสเปก | archetype เดิม (`G.WEAPON_ARCHETYPES`) | reloadStyle เดิม | จำนวนกระบอก |
|---|---|---|---|
| pistol | pistol | pistol | 5 |
| revolver | — (ยังไม่มีปืนลูกโม่) | ทำ recipe ไว้ใช้ภายหลัง | 0 |
| SMG | smg | rifle | 4 |
| rifle | rifle | rifle | 5 |
| shotgun pump | shotgun (`mag: "tube"`, `auto:false` ทุกกระบอก) | shotgun (ทีละนัด) | 6 |
| shotgun semi | — (ไม่มีลูกซองกึ่งอัตโนมัติ) | ทำ recipe ไว้ | 0 |
| sniper bolt-action | sniper | bolt | 5 |
| LMG | lmg | belt | 6 |
| special | launcher (6), cannon (4) → launcher · energy (4), beam (5) → rifle (แม็กเป็น cell) | ตามเดิม | 19 |
| knife | `G.MELEE_DEF` | — | 1 |

รวมปืน 85 กระบอก (สเปกเขียน "60 กว่า") — ข้อมูลแอนิเมชันอยู่ที่ระดับตระกูล + override ต่อกระบอก (`def.anim`) ถ้าจำเป็น

## 4. สถานะ

แนวคิด: **ท่าพื้น** (Idle / Walking / Sprinting / Aiming) คำนวณจาก locomotion + การเล็งเมื่อไม่มี action, ส่วน **action** (Firing, Recovering, Reloading, Inspecting, Switching, Melee) และ **สถานะครอบ** (Lowered, Disabled) มีลำดับเหนือกว่า

| สถานะ | เข้าเมื่อ | ออกไป | แอนิเมชัน | เสียง / VFX ที่อนุญาต | UI | Guard กันเข้าซ้ำ | event ช้า/ไม่มา | Watchdog (สูงสุด) |
|---|---|---|---|---|---|---|---|---|
| **Idle** | ไม่มี action, ไม่ขยับ, ไม่เล็ง | ทุกสถานะ | หายใจ (sine + noise ความถี่ต่ำ, แรงขึ้นเมื่อ stamina ต่ำ) | ทุกอย่างที่เกิดจาก event | ปกติ | — | — | — |
| **Walking** | ความเร็ว > 0.3 m/s, ไม่วิ่ง | ทุกสถานะ | gait bob เดิม (`G.PlayerBody.gait`) ซิงก์ฝีเท้า | ฝีเท้า | ปกติ | — | — | — |
| **Sprinting** | วิ่งค้าง + เดินหน้า + stamina เหลือ + ไม่มี action ที่ห้าม | Idle/Walking (ผ่าน sprint-out delay), Switching, Reloading (ต่อเนื่อง), Melee, Lowered, Disabled | ท่าถือวิ่ง `SPRINT[weight]` เดิม | ฝีเท้าวิ่ง | crosshair จาง | ปิดการเล็ง | — | — |
| **Aiming** | คำขอเล็ง + ไม่วิ่ง/สลับ/รีโหลด | Firing, Reloading, Switching, Inspecting→ยกเลิก, Idle | aim weight 0→1 แบบ ease ตามน้ำหนัก (0.15/0.22/0.30/0.34 วิ) ลด sway/bob | ADS cloth เบา ๆ | crosshair/scope เดิม | ห้ามระหว่าง Sprinting/Switching/Reloading; ถ้ายังกดค้างตอนรีโหลดจบ → เข้าทันที | — | — |
| **Firing** | คำขอยิง + cooldown พร้อม + มีกระสุน (จาก Idle/Walking/Aiming/Recovering; จาก Sprinting ต้องรอ sprint-out; Inspecting ยกเลิกแล้วยิง; Lowered ยกปืนก่อน 0.12 วิ) | Recovering (เฟรมถัดไป) | kick (ถอย + เงย) จาก spring เดิม | shot (1 ชุดต่อ `shotId`), flash, smoke, shell | ammo ลดหลัง gameplay | `shotId` ไม่ซ้ำ; เฟรมเดียวยิงได้ไม่เกินจำนวนที่ cooldown อนุญาต | ไม่มี (ยิงเกิดใน gameplay ก่อน event) | 0.1 วิ |
| **Recovering** | หลังยิง | Firing (ยิงต่อ), ท่าพื้น (cooldown หมด + recoil < เกณฑ์), Reloading, Switching, Melee | recovery curve; ปืนออโต้ recoil สะสมมีเพดาน | — | — | — | — | cooldown + 0.5 วิ |
| **Reloading** | คำขอรีโหลด หรือยิงตอนแม็กหมด (Auto Reload) + แม็กไม่เต็ม + สำรอง > 0 | ท่าพื้น/Aiming (จบ), ยกเลิกตามตาราง §6 | keyframe ตาม style + phase (§5) ผสมท่าวิ่งได้ | marker ของ `reloadId` เท่านั้น | แถบความคืบหน้าจาก timer gameplay, ammo อัปเดตหลัง commit | `reloadId` ใหม่ทุกครั้ง, รีโหลดซ้อนไม่ได้ | commit fallback (§5) | `dur × 1.5 + 0.5 วิ` |
| **Inspecting** | ปุ่ม inspect (ค่าเริ่มต้น **G**), อยู่ในท่าพื้นที่ไม่วิ่ง | ท่าพื้น (จบ), **ทุก action ยกเลิกทันที** | หมุนโชว์ปืน 2.2 วิ ต่อตระกูล | เสียงผ้า/กลไกเบา (ผูก `inspectId`) | — | ไม่เข้าซ้ำระหว่างเล่น | — | 3 วิ |
| **Lowered** | กด E โต้ตอบ (0.45 วิ), หน้าต่างคำถามที่หยุดโลก (freeze: คำถามประตู/บอส ฯลฯ — ปืนลดลงนุ่ม ๆ ระหว่างตอบ) · หน้าต่างแบบ pause (note, crate, ร้าน) หยุดทุกอย่างรวมถึงปืน · ช่วงพักระหว่างเวฟในเกมนี้คือ quiz/ร้าน (หน้าต่างอยู่แล้ว) | ท่าพื้น (เหตุผลหมด), Firing (ยกขึ้น 0.12 วิ ก่อน) | ลดปืนลงนุ่ม ยกกลับเร็ว | — | — | ใช้ชุด reason (หลายเหตุพร้อมกันได้) | — | ตรวจ reason ทุกเฟรม |
| **Switching** | คำขอสลับช่องที่ต่างจากปัจจุบันและมีของ | ท่าพื้นของปืนใหม่ | ลด (ครึ่งแรก) → เปลี่ยนโมเดลที่จุดต่ำสุด → ยก (`FEEL.switchDur` เดิม: 0.40/0.46/0.56/0.66, มีด 0.34) | holster/draw ผูก `switchId` | ช่องที่เลือกเปลี่ยนทันทีเมื่อขอ | กดรัวจำเฉพาะช่องสุดท้าย (ถ้ายังไม่ถึงจุดเปลี่ยนโมเดล = เปลี่ยนเป้าหมาย, ถ้าเลยแล้ว = ต่อคิว 1 ช่อง) | ไม่มี marker = เปลี่ยนโมเดลตามเวลา | `switchDur × 2 + 0.3 วิ` |
| **Melee** | ยิงขณะถือมีด (ช่อง 0) | ท่าพื้น | ง้าง → ฟัน (ท่าเดิม) | swish ที่ start, hit ที่ marker `hit` | — | `meleeId`, `hit` ครั้งเดียว | hit-frame fallback ตามเวลา | `fireRate + 0.3 วิ` |
| **Disabled** | ตาย, cutscene บอส, เปลี่ยนด่าน, loading, Game Over | ท่าพื้น (reset ทั้งหมด) เมื่อ reason หมด | ซ่อน viewmodel | หยุดทุกเสียง/VFX ของปืน | — | ชุด reason | — | ตรวจ reason ทุกเฟรม |

**ปืนชาร์จ (energy/beam บางกระบอก) และยิงชุด (burst)** ที่มีอยู่แล้ว: ชาร์จ = ธง `charging` ในท่าพื้น (ไม่ใช่สถานะแยก) ปล่อยไก → Firing; burst = นัดตามใน Firing/Recovering ผูก `shotId` ต่อนัด

**กระสุนหมด**: dry-fire ครั้งเดียวต่อการกดไก (`weapon:dryfire`) → รีโหลดอัตโนมัติถ้า `settings.autoReload` (ค่าเริ่มต้นเปิด = พฤติกรรมเดิม) ถ้าสำรองหมด → เสียงปฏิเสธ + ข้อความบน HUD

## 5. รีโหลดแบบแบ่งช่วง

- **Plan** ยังมาจาก `planReload(def, missing, kind)` เดิม (ย้ายตารางเวลาไป `G.CONFIG.weaponSM.reload`) แล้วแปลงชื่อ marker ให้ตรงสเปก:

| marker ใหม่ | event เดิม | ใช้กับ |
|---|---|---|
| `start` | (ตอนเรียก reload) | ทุกแบบ |
| `coverOpen` / `coverClose` | `cover` / `coverClose` | LMG |
| `magOut` | `out` | แม็ก |
| `magDrop`, `magGrab` | `drop`, `grab` | แม็ก (ภาพ + เสียงเบา) |
| **`magIn` = commit** | `in` | แม็ก |
| `magSlap` | `slap` | แม็ก |
| `boltRelease` | `bolt` | **เฉพาะ empty** |
| `shellIn` (+index) = commit ทีละนัด | `shell` | ลูกซอง |
| `pump` | `pump` | ลูกซอง (ท้าย loop) |
| `end` | (dur ครบ) | ทุกแบบ |

- **tactical** (แม็กยังมีกระสุน): ไม่มี `boltRelease`, ความยาวรวม × `tacticalScale` (ค่าเริ่มต้น 0.85)
- **empty** (แม็กหมด): ครบทุก marker + `boltRelease`
- **loop** (ลูกซอง): `start` → `shellIn` × n → `pump` → `end`; กดยิงระหว่าง loop เมื่อแม็กมี ≥ 1 นัด → หยุดหลังนัดปัจจุบัน (ไม่ตัดนัดที่ใส่ไปครึ่งทาง)
- **Commit**: เกิดครั้งเดียวต่อ `reloadId` ตอน timer ของ gameplay ถึง `magIn` (ตารางเดิม 58–66% ของเวลา ใกล้ค่า ~70% ในสเปก) — marker ถูกส่งจาก timeline ของ gameplay เสมอ ภาพตามหลัง timeline ไม่ใช่กลับกัน
- **Fallback**: ถ้าถึงเวลา `magIn + 150 ms` แล้ว `committed` ยังเป็น false (เช่น dt กระโดดจากแท็บซ่อน, plan ถูกแก้) → commit ตอนนั้น ส่ง marker แบบ `silent:true` ให้เสียงไม่เล่นซ้ำ + warn ใน dev
- **Spell to Reload** (`G.SpellReload`): สถานะ Reloading ชนิด `spell` ระหว่าง modal เปิด, commit ตามผลสะกด (ของเดิม)
- **Quick Hands**: คูณ dt ของ timeline (ของเดิม) ภาพอ่าน `t/dur` จึงเร็วตามกัน

## 6. ตารางยกเลิกรีโหลด

| เหตุการณ์ระหว่างรีโหลด | ของเดิม | ใหม่ (ค่าเริ่มต้น, config) | กระสุน |
|---|---|---|---|
| สลับอาวุธ | ยกเลิก | ยกเลิก | ก่อน commit = ไม่เปลี่ยน / หลัง commit = เติมแล้ว |
| ใช้มีด (สลับไปช่อง 0) | ยกเลิก | ยกเลิก | เหมือนบรรทัดบน |
| กดยิง (แม็ก > 0, ยังไม่ commit) | ยกเลิกเฉพาะลูกซอง | ยกเลิกแล้วยิง (`fireCancelsReload: true`) ทุกตระกูล | ไม่เปลี่ยน |
| กดยิง หลัง commit | ไม่มีผล | ไม่ยกเลิก (รอจบท่า) | — |
| วิ่ง | **กดวิ่งใหม่ = ยกเลิก** | ไม่ยกเลิก ผสมท่าวิ่ง (`sprintCancelsReload: false`) — เปลี่ยนพฤติกรรมเดิม | ตามปกติ |
| โดนตี | ไม่มีผล | ไม่ยกเลิก + flinch additive | ตามปกติ |
| เปิด modal / pause | timeline หยุด (game.update หยุด) แต่เสียงที่ตั้งเวลาล่วงหน้าไม่หยุด | หยุดชั่วคราวทั้ง timeline และเสียง (เสียงเล่นจาก marker เท่านั้น) | ตามปกติ |
| teleport เข้าบอส / cutscene | ยกเลิก | Disabled → reset | ตามกติกาเดิม |
| ตาย / Game Over / เปลี่ยนด่าน | reset ผ่าน `startLevel` | Disabled → reset ทั้งหมด | ตามกติกาเดิม |

ยกเลิกเมื่อไร: `weapon:reload {phase:"cancel", reloadId}` → Audio หยุด/เฟดเสียงที่ผูก `reloadId`, ViewModel คืนชิ้นส่วน (แม็กกลับเข้าที่) ภายใน 0.15 วิ

## 7. ชั้นแอนิเมชัน (ต่อยอด `G.ViewModel`)

| ชั้น | มาจาก | ใหม่/เดิม |
|---|---|---|
| Base locomotion (idle/walk/sprint blend ตามความเร็ว) | `moveW`, `sprintW`, gait bob เดิม | เดิม + หายใจตาม stamina |
| Action (fire / reload / switch / inspect / melee) | reload keyframe + switch dip เดิม | เดิม + inspect + tactical/empty + อ่านจาก WSM แทน `reloadState` ตรง ๆ |
| Additive (recoil, หายใจ, ลงพื้น, โดนตี) | `recoilPos/Rot`, `land`, `bump` springs เดิม | เดิม + flinch, recoil สะสมมีเพดาน, Camera Recoil แยกและปรับ/ปิดได้ |
| Aim weight 0..1 | `aimT` เดิม (อัตราคงที่) | ease ตามน้ำหนัก |
| Visibility | viewmodel layer 1 (render pass แยกเดิม) | ซ่อนเมื่อ Disabled แล้วแสดงกลับพร้อมท่าที่ถูก |

**sprint-out delay** (ใหม่ แทนเกณฑ์ `sprintW > 0.25`): เบา 0.10 / กลาง 0.18 / หนัก 0.25 / หนักมาก 0.30 / มีด 0.06 วินาที

## 8. Event ที่ส่ง (ผ่าน `G.Bus`)

`weapon:state {from,to,reason}` · `weapon:fire {shotId, weaponId, family, rpm, burstIndex}` · `weapon:dryfire` · `weapon:reload {phase, kind, reloadId, marker, silent}` · `weapon:switch {phase: lower|swap|raise|done, switchId, fromId, toId, slot}` · `weapon:aim {on, weight}` · `weapon:inspect {phase, inspectId}` · `weapon:melee {phase: start|hit|end, meleeId, hit}` · `weapon:lowered {on, reasons}`

กติกา marker: หนึ่ง marker ต่อ instance ครั้งเดียว (`Set` ของ `${instanceId}:${marker}`) ซ้ำ = ignore + warn

## 9. Dev validator + Debug overlay (`?debug=1`)
- ตรวจทุกเฟรม: สถานะไม่เกิน watchdog, `0 ≤ mag ≤ magSize`, `reserve ≥ 0`, ไม่มี commit ซ้ำ, HUD ammo = Game State, ปืนบนจอ = ช่องที่เลือก (หลังสลับเสร็จ)
- overlay: สถานะ + เวลาในสถานะ, 10 event ล่าสุด, reload phase, aim weight, จำนวนเสียงที่เล่น (รอบ 3), particle/decal (รอบ 2), draw calls, frame time

## 10. แผนทดสอบ (เกณฑ์ผ่านรอบ 1)
- `tools/overhaul/wsm-test.js`: ทุก transition ในตาราง §4 + ตาราง §6 (ทั้งก่อนและหลัง commit)
- **fuzz** 10,000 คำขอสุ่ม (ยิง, รีโหลด, เล็ง, สลับ, inspect, มีด, pause, modal, ตาย, dt สุ่ม 0–0.25 วิ) แล้วยืนยัน invariant: ไม่ค้างเกิน watchdog, กระสุนไม่ติดลบและไม่เกินแม็ก, กระสุนรวม (แม็ก + สำรอง) ไม่เพิ่มขึ้นเอง, commit ≤ 1 ต่อ reloadId
- รันในเบราว์เซอร์ (`/tools/overhaul/test.html`) — **เครื่องนี้ไม่มี Node** ไฟล์เดียวกันรัน `node tools/overhaul/wsm-test.js` ได้ทันทีเมื่อติดตั้ง Node
- `tools/round21-test.js` (`G.Round21Test`): ทดสอบในเกมจริง — ยิง/sprint-out/รีโหลดทั้งสามแบบ/ตารางยกเลิก/หน้าต่างคำถาม/pause/Game Over/สลับรัว/มีด hit frame/inspect/Lowered/cutscene/การตั้งค่า/ตำแหน่งปืน 4 อัตราส่วน/HUD ammo ตรงกับเกมทุกเฟรม/watchdog + รัน wsm-test ในหน้าเกม
- ชุด `tools/round1..20-test.js` เดิมต้องผ่านทั้งหมด
