# Plan — ส่วนขยาย 7 ระบบ (รอบ 0)

อ้างอิงโค้ดจาก `audit.md` · สเปกเต็ม `PROMPT.md`

## 1. หลักการทุกรอบ

- ทำทีละรอบ แล้วหยุดรอผู้ใช้ตรวจ รายงานภาษาไทย · commit ในเครื่องเท่านั้น ผู้ใช้ `git push` เอง
  (prompt ข้อ 10 และรอบ 9 บอกให้ทำต่อและ push เอง แต่กติกาประจำของผู้ใช้มาก่อน เหมือนซีรีส์ overhaul)
- 1 รอบ = commit แยกอย่างน้อย 1 ก้อน ไม่ amend ของเดิม
- ชุดทดสอบใหม่เลข 29 + รอบ: รอบ 1 = `tools/round30-test.js` · รันชุดเดิมทั้งหมดทุกรอบ + `check-strings`, `check-paths`, `thai-scan`, `validate-words`
- แก้ไฟล์ใน `public/` แล้วรัน `tools/make-version.ps1` ก่อน commit
- ระบบใหม่มี flag ใน `G.CONFIG.expansion.<ระบบ>` เพื่อปิดได้โดยไม่ต้อง revert
- ข้อความใหม่ลง `strings*.js` ครบ 4 ภาษา · ตัวเลขลง config/data · popup ผ่าน `G.Modal` / `G.Dialog`
- ห้ามแก้คำศัพท์อัตโนมัติ · ห้ามมี secret ใน `public/` · ใช้ชื่อปืนสมมติ

## 2. ไฟล์ ความเสี่ยง และ rollback ต่อรอบ

### รอบ 1 — เซฟสำรอง ส่งออก นำเข้า
- **ใหม่**: `js/savemanager.js` (`G.SaveManager`: ที่เก็บ, migration, snapshot, export/import, merge), `docs/expansion/save-schema.md`, `tools/round30-test.js`
- **แก้**: `core.js` (`G.loadSave`, `G.persist`, `G.persistSoon`, `G.exportSave`, `G.readSaveFile`, `G.applyImportedSave`), `game.js` (จุด `isFirstRun` บรรทัด 58, จุดรอเซฟก่อน `G.Game.init`), `strings.js` (`G.earlySettings`), `settings.js` (หมวด Data, ย้ายปุ่มจาก Account), `mainmenu.js` (เตือนสำรอง), `index.html`, `style.css`, `strings*.js`, `sw`/`pwa` เท่าที่ต้องใช้, `serve-lan.ps1` (map `/tests/`)
- **ความเสี่ยงสูงสุดของทั้งซีรีส์** (เซฟหาย): บูต sync กับ IndexedDB async, เขียนค้างตอนปิดแท็บ, iPad ไม่รองรับบาง API
- **rollback**: คีย์ `vocabZombie_save_v1` ยังถูกเขียนต่อในรูปแบบแบนเดิมเป็นสำเนา sync ทุกครั้ง · `git revert` แล้วเกมเวอร์ชันเก่าอ่านคีย์นี้ได้ทันทีและไม่เสียความคืบหน้า · ก่อน migrate เก็บข้อความเดิมลง snapshot · migration ล้มเหลวไม่เขียนอะไรทับ

### รอบ 2 — รายงานบั๊ก + รายงานคำศัพท์
- **ใหม่**: `js/diag.js` (ring buffer), `js/bugreport.js`, `js/wordreport.js`, `tools/read-report.ps1`, `tools/list-word-reports.ps1`, `tools/round31-test.js`
- **แก้**: `bus.js` (`recent` 50, เพิ่ม `game:*`), `game.js` (ส่ง event, ปุ่มลัด), `core.js` (keybind `report`), `index.html` (hook error + `unhandledrejection`, ปุ่ม Pause), `explain*.js`, `vocabcard.js`, `ui.js` (ธงรายงาน), `settings.js` (หมวด Help/Support), `mainmenu.js`/หน้า HELP, `debug.js` (โชว์ overhead), `strings*.js`, `style.css`
- **ความเสี่ยง**: ครอบ `console.*` แล้วพัง, ภาพหน้าจอ WebGL ต้องจับหลัง render ในเฟรมเดียวกัน (`preserveDrawingBuffer` ไม่ได้เปิด), รายงานติดข้อมูลส่วนตัว
- **rollback**: `G.CONFIG.expansion.diag = false` ปิดทั้งตัวเก็บข้อมูล · `git revert` ไม่กระทบเซฟ (รายงานเก็บแยกใน store ของตัวเอง)

### รอบ 3 — ค่าพลังปืน + balance + การ์ด
- **ใหม่**: `js/data/gunstats.js` (ค่าเพิ่มต่อกระบอก ผูกกับ `G.WEAPON_DEFS` ไม่ทำซ้ำซ้อน), `js/statcard.js`, `tools/balance.js` (รันในเบราว์เซอร์ ดูข้อ 3.10), `docs/expansion/balance-report.md`, `.csv`, ตาราง changelog, `tools/round32-test.js`
- **แก้**: `config.js` (ค่าปืน, กติกา balance), `game.js` (falloff, spread, bloom, ส่วนดาเมจ), `weaponsm.js` (เวลา ADS/หยิบ/รีโหลดต่อกระบอก), `viewmodel.js`, `ui.js` (`renderWeaponLog`, ร้าน), `loadout.js`, `hud.js`, `strings*.js`, `style.css`
- **ความเสี่ยง**: 85 กระบอกต้องมี niche tag ไม่ซ้ำภายใน (ด่าน, rarity) · เปลี่ยน feel ของปืนที่ผู้เล่นคุ้น · ชุดทดสอบเดิมบางชุดอาจผูกกับค่าเก่า
- **rollback**: ค่าเดิมทั้งหมดอยู่ใน changelog (เดิม → ใหม่) · flag `expansion.gunStats` คืนสูตรเดิม · ไม่แตะเซฟ

### รอบ 4 — อาวุธระยะประชิด
- **ใหม่**: `js/melee.js` (ข้อมูล + hit sweep), โมเดลอาวุธ, เสียงใน `js/data/soundbank.js`, `tools/round33-test.js`
- **แก้**: `config.js` (`G.MELEE_DEF` → ตาราง), `game.js` (`meleeAttack`, quick melee, ซื้อจากผนัง), `weaponsm.js` (`startMelee`, ชาร์จ, คอมโบ), `viewmodel.js`, `entities.js` (`buildMeleeMesh`), `world.js` (ห้องวางอาวุธ), `campus.js` (สวนดอกไม้แห้ง), `core.js` (keybind `quickMelee`), `settings.js` (`ACTIONS`), `gamepad.js`, `touchcfg.js` (ปุ่มใหม่ใน `IDS` และ migration ของ `touchLayout`), `hud.js`, `checkpoint.js`, `loadout.js`, `js/lab/weapons.js`, `strings*.js`
- **ความเสี่ยง**: ปุ่ม Digit1 เดิมต้องคงความหมาย (เลือกช่อง) · ปุ่มว่างเหลือน้อย (V, F, G, C, X, Q ถูกใช้แล้ว และ V ฮาร์ดโค้ดที่ `game.js:3536`) · ปุ่ม B ของ controller ถูกใช้แล้ว · hit sweep ใน Reduce Motion · เซฟเก่าไม่มีอาวุธในช่อง
- **rollback**: flag `expansion.melee` คืน `meleeAttack` เดิม · ค่าที่เพิ่มในเซฟมี default จึงอยู่ได้ทั้งสองทาง

### รอบ 5 — อุปกรณ์เสริมและสกิน
- **ใหม่**: `js/data/attachments.js`, `js/attachments.js`, `js/gunskins.js`, ตระกูลเสียง suppressed ใน `gunvoice.js`, `tools/round34-test.js`
- **แก้**: `entities.js`/`gunmodels.js` (จุดยึด, สกิน; ต้องครอบทั้งปืนมีต้นแบบ 44 กระบอก และไม่มีต้นแบบ 41), `gunskin.js`, `gunaudio.js`, `viewmodel.js` (ตำแหน่ง ADS), `game.js`, `ui.js` (WEAPONS), `core.js` (default save + migration), `js/lab/weapons.js`, `strings*.js`
- **ความเสี่ยง**: จำนวนชุด ADS (optic × ตระกูล) · draw calls ของ attachment · เสียงสองเส้นทาง (GunVoice กับชั้นเก่า) · เกณฑ์ปลดล็อกอ่านจาก SRS ต้องไม่ไปเขียนกลับ
- **rollback**: flag `expansion.attachments` · ของที่ปลดล็อกแยกอยู่ใน `progress` ปิดแล้วไม่มีผลต่อ SRS

### รอบ 6 — Word Forge
- **ใหม่**: `js/forge.js`, `js/forgepick.js` (เลือกคำ แยกเป็นตรรกะล้วนเพื่อทดสอบ), `js/forgescene.js`, `tools/round35-test.js`
- **แก้**: `world.js` (สถานี), `game.js` (`doInteract`, ดาเมจตาม tier), `checkpoint.js`, `loadout.js`, `hud.js`, `quiz.js`/`questions.js` (ถ้าต้องบังคับชนิดข้อ), `gunaudio.js`, `strings*.js`
- **ความเสี่ยง**: ผู้เล่นคำน้อยจะไม่มีคำพอให้ทำข้อสอบ (ห้ามใช้คำใหม่) · tier ซ้อนกับ `weaponLevels` ทำให้ปืนแรงเกิน · cooldown ต้องรอดผ่าน checkpoint
- **rollback**: flag `expansion.forge` ซ่อนสถานี · tier เป็นของรอบเล่น ไม่อยู่ในเซฟหลัก ยกเว้น checkpoint ซึ่งเป็นฟิลด์เสริม

### รอบ 7 — ด่านสอนเล่น + tips
- **ใหม่**: `js/trainingyard.js`, `js/gametips.js`, `tools/round36-test.js`
- **แก้**: `world.js`, `game.js`, `tutorial.js`, `mainmenu.js`, `settings.js` (หมวด Tips), `strings*.js`
- **ความเสี่ยง**: คำฝึกห้ามนับเข้า SRS — ต้องกันที่ `G.Learning.answerWord` ไม่ใช่ที่หน้าจอ · ผู้เล่นเก่าต้องไม่ถูกบังคับเข้าด่านสอน
- **rollback**: flag `expansion.trainingYard` · `G.Tutorial` เดิมยังอยู่

### รอบ 8 — บัญชีและคลาวด์ (พักไว้ตามคำผู้ใช้)
- **ใหม่**: `public/firebase-config.js`, Firebase SDK ที่ bundle แล้ว, `js/cloud.js`, `js/profile.js`, `firestore.rules`, `privacy.html`, `data-deletion.html`, `docs/expansion/ACCOUNT_SETUP.md`, `tools/round37-test.js`
- **แก้**: `account.js`, `mainmenu.js`, `settings.js`, `wrangler.jsonc`/`_headers` ถ้าต้องใช้ proxy, `strings*.js`
- **ความเสี่ยง**: ต้องใช้คีย์จากผู้ใช้ และ emulator ต้องมี Node + Java · บน iPad popup ถูกบล็อก
- **rollback**: flag ปิดใน production · ไม่มีคีย์ก็ไม่มีปุ่ม · เกมยังเล่นแบบ guest ได้เหมือนเดิม
- **ยังไม่เริ่มจนกว่าผู้ใช้จะสั่ง** และสเปกรอบนี้ต่างจากสเปกบัญชีเดิม (ข้อ 3.11)

### รอบ 9 — ทดสอบรวม
- **ใหม่**: `tools/round38-test.js`, หน้าต่างแนะนำ 7 ระบบ
- **แก้**: `updater.js`, `index.html` (หน้า HELP), `strings*.js`
- ผู้ใช้ `git push` เอง

## 3. จุดที่ prompt ไม่ตรงกับเกม และสิ่งที่ตัดสินใจ

| # | ปัญหา | แนวทาง | ใครตัดสิน |
|---|---|---|---|
| 1 | IndexedDB async แต่บูตและ `strings.js` อ่านเซฟแบบ sync · ตอน `pagehide` เขียน IndexedDB ไม่ทันได้ | IndexedDB เป็นหลัก + คีย์ v1 เดิมเป็นสำเนา sync (`pagehide` เขียนคีย์นี้ทันแน่นอน, `strings.js` อ่านต่อได้) · บูตอ่านทั้งสองแล้วใช้อันที่ `updatedAt` ใหม่กว่า รอ IndexedDB ก่อน `G.Game.init` ไม่เกิน ~1.5 วินาที | ทำตามนี้ |
| 2 | schema แบ่งหมวด แต่โค้ดอ้าง `G.save` แบน 302 จุด | บนดิสก์เป็นหมวด · ในหน่วยความจำคง `G.save` แบบเดิม แปลงตอนอ่าน/เขียน | ทำตามนี้ |
| 3 | prompt ขอ debounce ≥ 2 วินาที | `G.persist()` คงชื่อเดิม แต่เป็น mark dirty + debounce + flush ตอน hidden/pagehide | ทำตามนี้ |
| 4 | ไม่มี quick melee, มีดทะลุผนัง, ไม่ใช้ stamina | รอบ 4 สร้างใหม่ · keybind `quickMelee` ใหม่ · Digit1 ยังเลือกช่อง | ทำตามนี้ |
| 5 | rarity มี 5 ขั้น ตารางงบมี 6 | ไม่เพิ่มขั้น `legendary` ให้ใช้ 5 ขั้นเดิม (flag `legendary` เดิมคงไว้) | ทำแล้วในรอบ 3 · ค่า 1.45 อยู่ใน config แต่ไม่มีปืนใช้ |
| 6 | ไม่มีสูตรเพิ่ม HP ตามเวฟ | เพิ่ม config `zombies.hpByWave` ทำกราฟในรอบ 3 แต่เปิดใช้พร้อม Word Forge รอบ 6 · ถ้าไม่เพิ่ม เป้า "เวฟ 20 ใช้นัด 2–3 เท่า" ทำไม่ได้ | สร้างแล้วในรอบ 3 และปิดไว้ (`on: false`) ผู้ใช้ยังไม่ได้ตอบ **ถามอีกครั้งก่อนเปิดในรอบ 6** |
| 7 | ไม่มี CEFR | ใช้ `awlSublist`/`source` เป็นตัวแทนความยาก หรือเพิ่มคอลัมน์ใน CSV · คำฝึกด่านสอนเป็นรายการเลือกเอง | **ผู้ใช้เลือกก่อนรอบ 6** (ไม่บล็อกรอบ 1–5) |
| 8 | "word family ครบ" ไม่มีนิยาม | นิยาม: คำหลักอยู่กล่อง ≥ 4 และตอบรูปคำใน `family` ถูกครบ | เสนอในรอบ 5 |
| 9 | tier ซ้อนกับ `weaponLevels` | คูณต่อกัน และคำนวณใน balance report | ทำตามนี้ แจ้งในรอบ 6 |
| 10 | prompt ใช้เครื่องมือ Node แต่เครื่องนี้ไม่มี | `tools/balance` รันในเบราว์เซอร์ / PowerShell · emulator ต้องใช้ Node + Java | **ผู้ใช้ตอบก่อนรอบ 8** |
| 11 | รอบ 8 ต่างจากสเปกบัญชีเดิม: UID สุ่มกับ `publicIds/{id}` เทียบกับเลขรัน, avatar 128×128 ≤ 60 KB เทียบกับ 256×256 ≤ 100 KB, เปลี่ยนชื่อวันละครั้ง, `/data-deletion.html`, anonymous auth, SDK จาก npm | ยึดสเปกใหม่ใน `PROMPT.md` ถ้าผู้ใช้ไม่บอกเป็นอย่างอื่น | **ผู้ใช้ยืนยันตอนเริ่มรอบ 8** |
| 12 | `/tests/` เปิดจากเบราว์เซอร์ไม่ได้ | เพิ่ม map ใน `serve-lan.ps1` รอบ 1 | ทำตามนี้ |
| 13 | Bus มี event น้อย | เพิ่ม `game:*` และ `recent` 50 รอบ 2 | ทำตามนี้ |
| 14 | Settings ไม่มี Data/Help/Tips | เพิ่มในรอบ 1, 2, 7 | ทำตามนี้ |
| 15 | GPU ของ Edge headless ค้างในเซสชันนี้ | ใช้ SwiftShader ทดสอบตรรกะ · ตัวเลข FPS จาก SwiftShader เทียบกับของจริงไม่ได้ · รอบ 9 ต้องวัดบน GPU จริง | รายงานตามจริงทุกรอบ |
| 16 | ปืนมี 2 กลุ่มโมเดลและ 2 ทางเสียง | รอบ 5 ทดสอบทั้งสองกลุ่ม | ทำตามนี้ |
| 17 | `lastReviewedAt` ไม่มี SRS เก็บเลขวัน | merge เทียบ `last` ก่อน ถ้าเท่ากันเทียบ `n` แล้ว `b` · เพิ่มฟิลด์เวลาจริงต่อคำไม่ได้โดยไม่เพิ่มขนาดเซฟ | ทำตามนี้ แจ้งในรอบ 1 |
| 18 | ไม่มีปุ่มรีเซ็ตความคืบหน้า | รอบ 1 สร้างใหม่ พิมพ์ยืนยัน + snapshot | ทำตามนี้ |

## 4. Rollback ระดับซีรีส์

1. commit ต่อรอบ → `git revert <commit>` ถอยเฉพาะรอบ
2. คีย์ `vocabZombie_save_v1` ไม่ถูกลบตลอดซีรีส์และยังอยู่ในรูปแบบเดิม · snapshot ก่อนการกระทำเสี่ยงทุกครั้ง
3. flag ใน config ปิดระบบใหม่ได้โดยไม่ต้อง deploy โค้ดอื่น
4. service worker และ updater ทำงานเหมือนเดิม ผู้เล่นได้เวอร์ชันถอยกลับผ่าน flow อัปเดตปกติ

## 5. ลำดับการพึ่งพา (เช็กแล้ว)

- overhaul รอบ 1–8 เสร็จแล้ว (`4781987`) และปืนตามคลิปอ้างอิงเสร็จแล้ว (`cf6a748`) จึงไม่มีรอบใดต้องรอ
- รอบ 1 ต้องเสร็จก่อนรอบ 5 (ของที่ปลดล็อกอยู่ใน `progress`) และรอบ 8 (merge, snapshot)
- รอบ 3 ต้องเสร็จก่อนรอบ 4–6 (ตารางค่าพลังและการ์ด)
- รอบ 2 ควรเสร็จก่อนรอบ 3 เพื่อให้ผู้ใช้ส่งรายงานบั๊กจาก iPad ได้
