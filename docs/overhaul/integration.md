# Integration Instructions — การปรับเปลี่ยนครั้งใหญ่ (รอบ 0–8)

เอกสารนี้บอกว่าระบบใหม่ของงานนี้ต่อเข้ากับเกมเดิมตรงไหน และถ้าจะเพิ่มของใหม่ (ปืน ซอมบี้ เสียง คำอธิบาย ค่าตั้ง) ต้องแตะไฟล์อะไร
รายละเอียดการออกแบบแต่ละส่วนอยู่ใน `architecture.md`, `weapon-state-machine.md`, `audio-event-map.md`, `vfx-event-map.md`, `zombie-concepts.md`

## 1. หลักการเดิมที่ยังใช้

- script ธรรมดาใน `public/js/` แขวนทุกอย่างบน `window.G` ไม่มี bundler — **ลำดับ `<script defer>` ใน `public/index.html` คือลำดับโหลด** และ `config.js` ต้องเป็น script เกมตัวแรก (ชุดทดสอบ 8 ตรวจ)
- Three.js **r128** เท่านั้น (cdnjs)
- ค่าตัวเลขที่ปรับได้อยู่ใน `public/js/config.js` (`G.CONFIG.*`) — โค้ดอ่านค่าตอนใช้ ไม่ cache
- ข้อความทุกตัวผ่าน `G.T(key)` ไฟล์ `strings.js` (อังกฤษ) + `strings-th.js`, `strings-zh.js`, `strings-fr.js` — key ต้องครบ 4 ภาษา (`tools/check-strings.ps1`)
- Save: `G.normalizeSave()` ใน `core.js` เติมค่าเริ่มต้นและแก้ค่าที่ผิด — **เพิ่ม key ใหม่ใน settings ต้องเพิ่มทั้งค่าเริ่มต้นและบรรทัดตรวจใน normalizeSave** (save เก่าจึงไม่พัง)
- ไม่มี secret ใน `public/`

## 2. ไฟล์ใหม่ของงานนี้

| ไฟล์ | รอบ | หน้าที่ |
|---|---|---|
| `js/bus.js` | 1 | `G.Bus` event bus กลาง (`on`, `emit`, `recent` สำหรับ debug) |
| `js/weaponsm.js` | 1 | Weapon State Machine — สถานะจริงของอาวุธ (ยิง/รีโหลด/สลับ/เล็ง/วิ่ง/inspect) แยกจากภาพ |
| `js/debug.js` | 1 | overlay `?debug=1`, ตัวตรวจสถานะค้าง, stress test (ปุ่ม Stress), โหลดหน้า Lab |
| `js/lab/weapons.js`, `js/lab/sound.js`, `js/lab/zombies.js` | 1, 3, 4 | หน้า Lab: `?lab=weapons`, `?lab=sound`, `?lab=zombies` |
| `js/gunskin.js` | 2 | พื้นผิวปืน (texture procedural ต่อชิ้นส่วน) |
| `js/fx.js` | 2 | muzzle flash, ควัน, ปลอกกระสุน, เศษกระทบ, รอยกระสุน (งบตาม tier) |
| `js/surface.js` | 2 | ชนิดพื้นผิวของสิ่งที่กระสุนโดน |
| `js/acoustics.js` | 3 | reverb ตามโซน (IR procedural, crossfade A/B) |
| `js/captions.js` | 3 | คำบรรยายเสียง (Settings > Audio > Captions) |
| `js/data/soundbank.js` | 3 | `G.SOUND_BANK` ทุก event เสียง: ชนิด voice, bus, สูตรสังเคราะห์ |
| `js/zombiefactory.js`, `js/zombieanim.js`, `js/zombieai.js` | 4 | ซอมบี้ 10 ชนิด: รูปร่าง, แอนิเมชัน (state machine + blend), พฤติกรรม |
| `js/mainmenu.js`, `js/menuscene.js` | 5 | เมนูหลัก 3D (แทน Tap To Lobby) |
| `js/hud.js` | 6 | `G.Hud` HUD กลางล่าง (DOM ล้วน) |
| `js/explain.js`, `js/data/explain_th|zh|fr.js` | 7 | `G.Explain` / `G.ExplainView` / `G.ExplainCard` คำอธิบายคำตอบ |
| `js/gunref.js` | ปืนตามคลิป (ร่วมรอบ 1–3) | `G.GunRef` ต้นแบบ 9 แบบจาก `docs/reference/guns/GUN_REFERENCE.md`: ปืนกระบอกไหนเป็นต้นแบบอะไร (`proto`, `info`), พาเลต, สีเรือง, ตัวแทนของปืนในคลิป (`FLAGSHIP`), จังหวะขึ้นลำ bolt (`boltSteps`) |
| `js/gunmodels.js` | ปืนตามคลิป | `G.GunModels.build(def)` โมเดลกล่องของต้นแบบ A–I (ศูนย์เรือง ชิ้นที่ขยับ anchor ขนาดในมือ ท่าเล็ง) — `G.buildWeaponModel` เรียกก่อน ถ้าได้ `null` ใช้แบบเดิม |
| `js/gunvoice.js` | ปืนตามคลิป | `G.GunVoice` สูตรเสียงยิงต่อต้นแบบ (จูนตามหัวข้อ 5), หาง outdoor, ชุดเสียงกลไก/รีโหลด/หยิบ/inspect/bolt, ปลอกกระสุนตกพื้น |

ไฟล์เดิมที่แก้มาก: `game.js`, `viewmodel.js`, `audio.js`, `gunaudio.js`, `ui.js`, `settings.js`, `quiz.js`, `config.js`, `core.js`, `style.css`, `index.html`

## 3. จุดเชื่อมหลัก

### Event bus (`G.Bus`)
ผู้ส่งหลักคือ Weapon State Machine — ระบบอื่นฟังโดยไม่ต้องรู้จักกัน:

| event | ผู้ฟัง |
|---|---|
| `weapon:fire` | `fx.js` (flash/ควัน/ปลอก), `gunaudio.js` (เสียงปืน), viewmodel (recoil) |
| `weapon:reload` (phase/marker) | เสียงรีโหลดตามช่วง, viewmodel, HUD (แถบรีโหลด) |
| `weapon:switch`, `weapon:lowered`, `weapon:visible` | viewmodel, HUD, เสียง |
| `weapon:aim`, `weapon:inspect`, `weapon:melee`, `weapon:dryfire`, `weapon:noreserve`, `weapon:state` | viewmodel, เสียง, debug overlay |
| `player:hurt` | เสียง, flinch ของกล้อง |

กติกา: **สถานะเกมเพลย์ (กระสุน ดาเมจ) เปลี่ยนจาก state machine เท่านั้น** ภาพและเสียงเป็นผู้ฟัง — ปิดภาพ/เสียงได้โดยเกมยังถูกต้อง

### เกม → HUD
`G.Game` สร้าง payload ทุกเฟรม → `G.Hud.update(p)` เขียน DOM เฉพาะค่าที่เปลี่ยน (`shown` cache)
`G.Hud.fit()` จัด layout (กว้าง / แคบ / touch) เมื่อจอเปลี่ยน, ช่องเปลี่ยน, ภาษาเปลี่ยน, ability bar เปลี่ยน (รอบ 8: `syncAb` เรียกจาก fit ด้วย จึงถูกต้องแม้เกมหยุดอยู่)

### คำถาม → คำอธิบาย
ทุกจุดที่ถามเรียก `G.Explain.forQuestion(q, picked, right)` หรือ `forShot(...)` แล้วแสดงผ่าน `G.ExplainView` (ในหน้าต่าง) หรือ `G.ExplainCard` (การ์ดระหว่างยิง) — `G.Explain.remember()` บันทึกสาเหตุลง `G.save.learn.why`

### ระดับกราฟิก (Quality Tier)
`G.save.settings.graphicsQuality` = `vlow | low | medium | high | vhigh` ใช้ร่วมกันทั้งภาพและเสียง (`G.Audio.tier()`)
เปลี่ยนแล้วเรียก `G.Game.applyGraphicsQuality()` → `G.Perf.resizePool`, `G.FX.applyQuality`, `G.GunAudio.retune`; เมนูหลักสร้างฉากใหม่เมื่อ tier เปลี่ยน

| ค่าใน config | ความหมาย |
|---|---|
| `fx.budget[tier]` | particle / decal สูงสุด (decal นับรวมทุกชนิด — รอบ 8) |
| `fx.flash.lightEvery[tier]` | แสง muzzle ทุก n นัด (0 = ไม่มี) |
| `audio.total[tier]`, `audio.limits` | เสียงพร้อมกันทั้งหมด / ต่อชนิด |
| `audio.gunVariants`, `audio.hrtf`, `audio.occlusion`, `audio.reverbMode` | ตามตารางในสเปก |
| `menuScene.shafts / fog / dust` | ลำแสง หมอก ฝุ่นในเมนูหลัก (Medium = แบบง่าย 2 ลำแสง 1 ชั้นหมอก) |
| DoF/SSAO เมนู | เฉพาะ High/Ultra (`G.MainMenu.postOn()`) |

### Accessibility (`G.Access`, `core.js`)
ระบบที่สั่นหรือวาบอ่านตัวคูณจากที่เดียว:

| ฟังก์ชัน | ใช้ที่ | ค่า |
|---|---|---|
| `G.Access.shake()` | `game.js` shake + flinch, `cutscene.js` shake | Camera Shake × (Reduce Motion ? 0.35 : 1) |
| `G.Access.bob()` | `headbob.js` | Reduce Motion ? 0.5 : 1 |
| `G.Access.weaponBob()` | `viewmodel.js` gait bob | Weapon Bob × bob() |
| `G.Access.screen()` | `cutscene.js` flashScreen + CSS `--fx-screen` | Screen effects × (Reduce Motion ? 0.6 : 1) |
| `G.Access.flicker()` | `perf.js` updateLights, `menuscene.js`, `lightfx.js` floodlights | false เมื่อ Reduce Motion |

เอฟเฟกต์ CSS ทั้งจอ (`.hud-damage-flash`, `.hud-lowhp`, `.mystery-flash`, Focus Time) คูณ `var(--fx-screen)` — เพิ่มเอฟเฟกต์ใหม่ที่คลุมจอให้ใช้ตัวแปรนี้ด้วย
UI scale = `settings.fontSize` (small/medium/large) ตั้ง `font-size` ของ `<html>` (`config.ui.textScale`) — CSS ใช้ `rem` จึงขยายทั้งหน้า; HUD มีขนาดแยกต่อส่วน (`G.HudCfg`, `settings.hudScale`)

## 4. เพิ่มของใหม่

**ปืนกระบอกใหม่**
1. `config.js` → `G.WEAPON_DEFS` (id, rarity, damage, fireRate, magSize, reloadTime, auto, …; `archetype` ถ้าเดาจากค่าไม่ได้) — ตระกูล (`G.ViewModel.family`) เลือกท่า รีโหลด flash และเสียงให้เอง
2. โมเดล: ตามแบบปืนเดิมใน `weapons.js`/`viewmodel.js`; พื้นผิวจาก `gunskin.js` · ปืนที่แค่ตั้งโชว์ (บนผนัง บนพื้น ในมือ survivor ของเมนู) ใช้ `G.buildWeaponMesh(def, { still: true })` — ชิ้นที่ขยับรวมเข้าด้วยกัน เหลือ 1–2 draw call
3. ชื่อ: `strings*.js` 4 ภาษา
4. ตรวจใน `?lab=weapons` (ทุกสถานะ + ตัวตรวจค้างใน `?debug=1`)
5. (ปืนตามคลิป) ปืนพก / SMG / ไรเฟิล / LMG / สไนเปอร์ ได้ต้นแบบ A–I ของ `gunref.js` เองตามชนิดและค่า (`G.GunRef.proto`) → ได้โมเดล สี flash ปลอก ท่า และเสียงของต้นแบบ (เสียงขยับจากสูตรเล็กน้อยตาม id) — บังคับต้นแบบได้ด้วย `proto: "A"`…`"I"` ใน def หรือ `proto: null` ให้ใช้แบบเดิม · หลังเพิ่มต้องรัน `tools/gun-sound-check.js` (`await G.GunSoundCheck.runAll()` ต้อง `ok`) และชุดทดสอบ 29 · แก้สูตรเสียงต้นแบบด้วย `G.GunSoundCheck.tune(key, รอบ)` (ให้คะแนนจากปืนทุกกระบอกของต้นแบบ เอาตัวแย่สุด)

**ซอมบี้ชนิดใหม่**
1. `config.js` → `G.ZOMBIE_TYPES`, `G.ZOMBIE_KINDS`, `zombies.first` (เวฟแรก), `zombies.share`, `zombies.maxAlive`
2. รูปร่าง `zombiefactory.js` (`look`, `signature`), ท่า `zombieanim.js`, พฤติกรรม `zombieai.js` — ความสามารถพิเศษต้องไม่นับเป็นคำตอบ (ยังต้องยิงคำที่ถูก)
3. เสียงใน `soundbank.js` + caption, ชื่อ `zombie.kind.<id>` 4 ภาษา, หน้า How to Play (`howto.body2`)
4. ตรวจใน `?lab=zombies`

**เอฟเฟกต์ใหม่ที่สร้างวัสดุตอนเล่น** (ระเบิด, เศษ, ป้าย): shader ของวัสดุชนิดใหม่จะถูก compile ครั้งแรกที่มันโผล่ = เฟรมสะดุด 0.1–0.7 วิ — ใช้ pool ที่สร้างตอนโหลดด่าน หรือเพิ่มชิ้นแทนที่ใช้วัสดุแบบเดียวกันใน `G.Game.warmPieces()` (`game.js`); ตรวจด้วย `tools/stress-test.js` (ช่อง `spikes` บอกจำนวน shader program ณ เฟรมที่สะดุด)

**เสียงใหม่**: เพิ่ม entry ใน `G.SOUND_BANK` (cat, bus, prio, สูตร) → เล่นผ่าน `G.Audio` ซึ่งจำกัดจำนวน voice เอง; ฟังใน `?lab=sound` · ไฟล์เสียงจริง (ถ้ามี) CC0 เท่านั้น ใส่ใน `SOUND_CREDITS`

**คำอธิบาย/คำแปลใหม่**: `js/data/explain_<lang>.js` (`confusableNotes`, `spelling`, `explain`, `ex`) → `tools/validate-words.ps1` ตรวจความครบ

**ค่าตั้งใหม่**: ค่าเริ่มต้นใน `core.js` (`defaultSave().settings`) + บรรทัดใน `normalizeSave` + แถวใน `settings.js` + ข้อความ 4 ภาษา + ข้อทดสอบ migration

## 5. เครื่องมือทดสอบ (ไม่ได้ deploy — อยู่ใน `tools/`)

- `serve-lan.ps1` เปิดเว็บที่ :8080 (map `/tools/` ด้วย)
- ชุดทดสอบ `tools/round1-test.js` … `round29-test.js` โหลดเข้าเกมแล้ว `await G.RoundNTest.run()` (29 = ปืนตามคลิปอ้างอิง)
- `tools/gun-sound-check.js` วัดเสียงปืนตาม `GUN_REFERENCE.md` หัวข้อ 5 (`run()` ตัวแทน 9 กระบอก, `runAll()` ทุกกระบอกของต้นแบบ, `table()`, `tune()`)
- `tools/stress-test.js` (`G.StressTest.run(tiers, frames)`), `tools/visual-test.js` (`G.VisualTest.perf`), `tools/perf-measure.js`
- `tools/ui-text-audit.js` ทัวร์ทุกหน้าหาข้อความล้น/ทับ/หลุดจอ
- `tools/check-strings.ps1`, `thai-scan.ps1`, `check-paths.ps1`, `validate-words.ps1`, `make-version.ps1`

## 6. Deploy

1. ไฟล์ใน `public/` ทุกไฟล์ < 25 MiB (ข้อจำกัด Cloudflare Workers assets)
2. `tools/make-version.ps1` → `public/version.json` ใหม่ (iPad/เครื่องอื่นเห็นว่ามีอัปเดต)
3. commit แล้ว **ผู้ใช้ push `main` เอง** → Cloudflare Workers Builds deploy
