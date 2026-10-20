# Implementation Plan (รอบ 0)

## 1. หลักการทุกรอบ
- แต่ละรอบ = commit แยก (local) ข้อความ commit ภาษาไทยบอกรอบและสิ่งที่ทำ — rollback รอบใดก็ได้ด้วย `git revert <commit>`
- ระบบใหม่เปิด/ปิดได้ด้วย flag ใน config (`G.CONFIG.overhaul.<ระบบ>`) จนกว่ารอบ 8 จะยืนยัน ถ้าเจอปัญหาบน iPad ปิด flag แล้ว push ได้ทันทีโดยไม่ต้อง revert
- ทุกรอบรัน `tools/round1..20-test.js` เดิม + test ใหม่ของรอบนั้น + `tools/check-strings.ps1` (4 ภาษาครบ) + วัด FPS ด้วย `tools/perf-measure.js` ที่ 1280×720 ทุก tier เทียบกับตัวเลขก่อนเริ่ม
- ข้อความใหม่ทุกตัวผ่าน `strings*.js` ครบ 4 ภาษา · ค่าปรับจูนใน `config.js` · หน้าต่างใหม่ผ่าน `G.Modal`
- เปลี่ยนโครง save → เพิ่ม default ใน `G.defaultSave` + ซ่อมใน `G.normalizeSave` (migration เดิมรองรับฟิลด์ใหม่อยู่แล้ว) ห้ามลบฟิลด์เดิม

## 2. ลำดับงานและไฟล์

### รอบ 1 — Weapon State Machine + แอนิเมชัน
- **ใหม่**: `js/bus.js` (`G.Bus`), `js/clock.js` (`G.Clock`), `js/weaponsm.js` (`G.WeaponSM` ตรรกะล้วน), `js/debug.js` (overlay, โหลดเมื่อ `?debug=1`), `js/lab/weapons.js` (`?lab=weapons`), `tools/overhaul/wsm-test.js` + `tools/overhaul/test.html`
- **แก้**: `game.js` (`reload`, `cancelReload`, `onReloadEvent`, `fireWeapon`, `meleeAttack`, `switchSlot`, `updateShooting`, `updatePlayerMovement` ส่วนเล็ง/วิ่ง/ยิง → เรียก WSM), `viewmodel.js` (อ่านสถานะ WSM, inspect, tactical/empty, flinch, หายใจ, sprint-out, aim ease), `config.js` (`weaponSM`), `core.js` (keybind `inspect`, settings `autoReload`, `cameraRecoil`, `cameraShake`), `settings.js`, `strings*.js`, `index.html` (script tags)
- ความเสี่ยง: พฤติกรรมยิง/รีโหลดเปลี่ยน (bot และชุดทดสอบเดิมอาจต้องปรับ), Spell to Reload, burst/charge, perk Quick Hands/Last Round/Marksman — ต้องทดสอบทุกตัว

### รอบ 2 — รูปลักษณ์อาวุธ + VFX
- **ใหม่**: `js/fx.js` (`G.FX` pool), `js/surface.js` (surfaceType กลาง), texture atlas ปืน (canvas ตอนโหลด)
- **แก้**: `entities.js` (`buildWeaponMesh` วัสดุ, `spawnMuzzleFlash`, `spawnShellEject`, `spawnHitParticles`), `visuals.js` (แสง viewmodel ตามโซน), `perf.js` (flash ตาม tier), `world.js`/`campus.js`/`schoolrooms.js`/`forest.js` (tag surface), `game.js` `raycastShoot` (ส่ง `hit:impact`)
- ลำดับปืน: โรงเรียน → โรงพยาบาล → บังเกอร์ (ตาม `level` ของ def)
- ความเสี่ยง: draw calls (ชุดภาพรอบ 2–3 เพิ่งจูนให้ Low < 150 ที่ประตู) → decal ใช้ InstancedMesh, flash ใช้ sprite ใน viewmodel pass

### รอบ 3 — เสียง
- **ใหม่**: `js/mixer.js` (bus Weapons/UI, limiter, ducking, voice pool ต่อหมวด, A/B reverb, occlusion), `js/data/soundbank.js`, `js/captions.js`, `js/lab/sound.js`
- **แก้**: `audio.js` (ย้ายเข้า mixer, คง API เดิม `sfx/tone/noise/boss/...` ไว้เป็นทางผ่าน), `gunaudio.js` (pre-render OfflineAudioContext + variants, reload marker), `game.js` (ฝีเท้าตาม surface), `settings.js` (slider + ปุ่มทดสอบ)
- ความเสี่ยง: CPU ตอน pre-render บน iPad (ทยอย render ช่วง idle), iOS unlock (ใช้ของเดิม), ความดังเปลี่ยนจากเดิม (วัด peak/RMS ทุกกระบอก)

### รอบ 4 — ซอมบี้ 10 ชนิด
- **ใหม่**: `docs/overhaul/zombie-concepts.md`, `js/zombiefactory.js` (ชิ้นส่วน + atlas), `js/zombieanim.js` (state machine ต่อตัว + LOD), `js/lab/zombies.js`, `docs/overhaul/zombie-sheet.png`
- **แก้**: `entities.js` `G.Zombie` (ต่อยอดชุดเดิม: odd looks `headInHand` → Headless, `longArm`/`bigArm` → Reacher, `deformed` → Abomination, outfits ตามด่าน), `config.js` (`ZOMBIE_TYPES` + `WAVE_TABLE` ชนิดใหม่ — ชื่อเดิม `normal/fast/crawler` map เป็น Shambler/Sprinter/Crawler เพื่อไม่ให้ checkpoint/save พัง), `aim.js` (hitbox ใหม่), `systems.js` (spawn), `zombiefx.js` (Blood & Gore), `bossmodels.js` (ผิว/ศิลป์ คงรูปร่าง)
- ความเสี่ยง: ประสิทธิภาพเวฟเต็ม (iPad Medium ≥ 30 FPS), กติกาคำศัพท์ (ความสามารถพิเศษห้ามฆ่าหรือข้ามการตอบคำ), ตัวนับซอมบี้บน HUD เมื่อ Screamer เรียกเพิ่ม

### รอบ 5 — เมนูหลักใหม่
- **ใหม่**: `js/mainmenu.js` (ฉาก 3D ทางเดินใต้ดิน + ผู้รอดชีวิต + เมนูซ้าย), `css` ส่วนเมนู, ฟอนต์โลโก้ OFL (ดูข้อ 4) หรือโลโก้ SVG
- **แก้**: `start.js` (ปลดออกจาก flow, ย้าย unlock เสียง/อัปเดต/แถบบัญชีไปเมนูใหม่), `boot.js` (Loading → Main Menu), `lobby.js` (เอาไอคอนออก, เพิ่มปุ่มกลับ), `sw.js` (precache ฟอนต์), `index.html`
- เมนูซ้าย ← ไอคอนลอบบี้เดิม: PLAY · PROGRESS (`progress`) · VOCAB (`wordlog`) · NOTES (`journal`) · CUSTOM (`custom`) · WEAPONS (`armory`) · BOSSES (`bosses`) · RANKS (`leaderboard`) · AWARDS (`achievements`) · SETTINGS (`settings`) · HELP (`help`) + DAILY REVIEW (badge จำนวนคำถึงกำหนดจาก `G.SRS`)
- ความเสี่ยง: หน่วยความจำ iPad (dispose ฉากเมนูตอนเข้าเกม), ลำดับ unlock เสียงบน iOS

### รอบ 6 — HUD กลางล่าง
- **แก้**: `index.html` (โครง HUD ใหม่), `css/style.css`, `ui.js` `updateHud`, `game.js` `buildHudState` (เพิ่ม wave total, floor, mission counter), `hudcfg.js` (ขนาดต่อส่วน), `touchcfg.js` (แสดงขอบเขต HUD + กันวางทับ), `loadout.js` (ไฮไลต์ช่องตอนเลือกแทน)
- ความเสี่ยง: touch layout ที่ผู้เล่นเซฟไว้ทับ HUD ใหม่ → ตรวจตอนโหลดแล้วเลื่อนปุ่มขึ้น (migration)

### รอบ 7 — คำอธิบายคำตอบ
- **ใหม่**: `js/explain.js` (ประกอบคำอธิบาย + template + edit distance), `js/data/explain_th.js` / `_en` / `_zh` / `_fr` (หมายเหตุต่อคำ + คำแปลตัวอย่าง), `confusableNotes`, test อัตโนมัติ
- **แก้**: `quiz.js`, `questions.js`, `spell.js`, `learnmodes.js`, `study.js`, `practice.js`, `abilityui.js`, `floor3.js`, `game.js` `startWordChallenge` + การยิงคำ (การ์ดใต้กล่องคำถาม), `vocabcard.js`/`progress.js` (ประวัติ "ผิดเพราะอะไร"), `settings.js`, `tools/validate-words` (รายงานความครอบคลุม)
- ความเสี่ยง: ขนาดไฟล์ข้อมูล (แบ่งต่อภาษา โหลดเฉพาะภาษาที่ใช้), ความถูกต้องของเนื้อหา (ผู้ใช้ต้องสุ่มตรวจ)

### รอบ 8 — ทดสอบรวม + เตรียม deploy
- `docs/overhaul/integration.md`, `testing-checklist.md`, `performance-notes.md`, หน้า HELP, ตรวจขนาดไฟล์ < 25 MiB, `public/version.json`
- commit local — **ผู้ใช้เป็นคน push** (`git push origin main`) แล้ว Cloudflare deploy

## 3. ความเสี่ยงรวมและวิธีรับมือ

| ความเสี่ยง | รับมือ |
|---|---|
| ทำของเดิมพัง (perk, บอส, ability, SRS, checkpoint, mystery box, wall guns, notes, ประตูเลื่อน, update flow) | ชุดทดสอบ 20 ชุดเดิม + playtest bot ทุกรอบ, flag ปิดระบบใหม่ได้ |
| FPS ตก (iPad) | งบต่อ tier ใน config, วัดก่อน/หลังทุกรอบ, pool ทั้งหมด |
| ทดสอบบน iPad จริงไม่ได้จากเครื่องนี้ | ผู้ใช้ทดสอบหลัง push + เช็กลิสต์ใน `testing-checklist.md` |
| RAM เครื่องพัฒนา 3.9 GB | เปิดแท็บเกมทีละ 1 ตอนทดสอบ |
| ไม่มี Node / Playwright / wrangler | test เป็น JS ล้วนรันในเบราว์เซอร์ (headless Edge + DevTools protocol), เขียนให้รันใน Node ได้ทันทีเมื่อติดตั้ง |
| context ของ session หมดกลางรอบ | อัปเดต `progress.md` ก่อนจบงานย่อยทุกครั้ง |

## 4. จุดที่สเปกขัดกับระบบเดิม / ต้องตัดสินใจ

| # | เรื่อง | สเปก | ระบบเดิม | ทางที่เสนอ |
|---|---|---|---|---|
| 1 | จังหวะการทำงาน | กฎ 14: จบรอบแล้วไปรอบถัดไปเลย | ผู้ใช้กำหนด: ทำทีละรอบ หยุดให้ตรวจ รายงานภาษาไทย | **ทำทีละรอบแล้วหยุด** (กฎของผู้ใช้มาก่อน) จนกว่าผู้ใช้จะสั่งให้ทำต่อเนื่อง |
| 2 | Deploy | รอบ 8: commit + push `main` | ผู้ใช้กำหนด: commit local เท่านั้น ห้าม push | commit local, ผู้ใช้ push เอง |
| 3 | ปุ่มเล็ง | "ระบบเล็ง/ซูมคลิกซ้าย" | คลิกซ้าย = ยิง, **คลิกขวา = เล็ง** | คงคลิกขวา (ถือว่าสเปกพิมพ์สลับ) |
| 4 | ช่องอาวุธบน HUD | แบบร่าง 6 ช่อง (มีด + 5) | มีด + ปืน **4** ช่อง (`BASE_SLOTS: 4`) + perk `extra_slot` ได้ถึง 6 | แสดงตาม inventory จริง: เริ่ม 5 ช่อง (มีด + 4) แล้วเพิ่มเมื่อมี perk — **ถามผู้ใช้** |
| 5 | เครื่องมือทดสอบ | `npx wrangler dev`, Playwright, unit test ใน Node | เครื่องนี้ไม่มี Node/npx/Playwright | `serve-lan.ps1` + headless Edge; test รันได้ทั้งเบราว์เซอร์และ Node |
| 6 | จำนวน/ตระกูลปืน | "60 กว่ากระบอก", revolver, shotgun semi | 85 กระบอก 10 archetype ไม่มีปืนลูกโม่/ลูกซองกึ่งออโต้ | ทำ recipe ตระกูลไว้แต่ไม่เพิ่มปืนใหม่ |
| 7 | ปุ่ม inspect | ปุ่มว่างใน key remap | F = ability 2, V = ฟังคำซ้ำ, T = ข้าม tutorial | ค่าเริ่มต้น **G** (เปลี่ยนได้ในหน้าตั้งค่าปุ่ม) |
| 8 | เนื้อหาคำอธิบาย | ทุกคำ 4 ภาษา + ตัวอย่างพร้อมคำแปล | 886 คำ, examples ไม่มีคำแปล, confusables 63+18, misspellings 28 | template ครอบทุกคำ + เขียนเฉพาะสำหรับคู่สับสน/สะกดผิด + แปลตัวอย่าง — **ถามขอบเขต** |
| 9 | วิ่งระหว่างรีโหลด | ไม่ยกเลิก | กดวิ่งใหม่ = ยกเลิก | ตามสเปก (config `sprintCancelsReload`) |
| 10 | ยิงระหว่างรีโหลด | ยกเลิกแล้วยิงทุกปืน | เฉพาะลูกซอง | ตามสเปก (config `fireCancelsReload`) |
| 11 | เล็งระหว่างรีโหลด/วิ่ง | ห้าม | เล็งได้ | ตามสเปก |
| 12 | มีด | hit-frame event | โดนทันที | hit frame 0.08 วินาที (config) |
| 13 | Pause กับเสียง | เสียงที่ผูกจังหวะหยุดพร้อมเกม | เสียงตั้งเวลาล่วงหน้า (`at:`) เดินต่อตอน pause | เล่นจาก marker แทนการตั้งเวลา (รอบ 1 + 3) |
| 14 | ฟอนต์โลโก้ (รอบ 5) | ฟอนต์ OFL เก็บในโปรเจกต์ | ต้องดาวน์โหลดไฟล์ฟอนต์ | ขออนุญาตดาวน์โหลดตอนรอบ 5 หรือวาดโลโก้เป็น SVG เอง |
| 15 | ระบบบัญชี | เมนูหลัก: "ระบบบัญชียังพักไว้" | ชุด "new series" รอบ 4 (Firebase accounts) ยังค้าง | ทำ overhaul ก่อน บัญชีหลังจบ overhaul |

## 5. สมมติฐาน
- Three.js r128 ตลอดงาน (ไม่อัปเกรด) — ใช้เฉพาะ API ที่มีใน r128
- Quality tier เดิม 5 ระดับ (`vlow/low/medium/high/vhigh`) = Very Low/Low/Medium/High/Ultra ของสเปก
- ชื่อชนิดซอมบี้ใน save/checkpoint (`normal`, `fast`, `crawler`) คงไว้เป็น id และแสดงชื่อใหม่ผ่าน i18n
- เมนูหลักแทนหน้า Start; หน้า Lobby (carousel) คงเดิม + ปุ่มกลับ
- ไอคอน Daily Review ย้ายมาเมนูหลักพร้อม badge โดยการ์ดโหมดในลอบบี้ยังอยู่
- หน้า Lab อยู่ใน `public/` (เปิดบน iPad ได้) แต่โหลดเฉพาะเมื่อมี `?lab=`/`?debug=1` และไม่ precache
- Accessibility ใหม่ (Camera Shake/Recoil, Weapon Bob, Muzzle Flash, Screen Effects, Reduce Motion, Blood & Gore, Captions) เพิ่มในหน้า Settings เดิม — `headBob`/`headBobOff` เดิมคงไว้และ map เข้า Weapon Bob/Camera Shake
