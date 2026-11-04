# Audit — สำรวจระบบเดิมก่อนทำส่วนขยาย 7 ระบบ (รอบ 0)

สำรวจจากโค้ดจริงที่ commit `cf6a748` (2026-11-04) ทุกตัวเลขนับจากโค้ดหรือจากเกมที่รันจริง เลขบรรทัดอาจเลื่อนเมื่อโค้ดเปลี่ยน
หัวข้อ "ต่างจาก prompt" คือจุดที่ `PROMPT.md` เขียนไว้ไม่ตรงกับเกม — การตัดสินใจของแต่ละจุดอยู่ใน `plan.md` หัวข้อ 3

---

## 1. ระบบเซฟเดิม

### เก็บที่ไหน คีย์อะไร
- **localStorage คีย์เดียว** `vocabZombie_save_v1` (`core.js:36`) เก็บ `G.save` ทั้งก้อนเป็น JSON แบบแบน ไม่มี `schemaVersion`
- ไม่มี IndexedDB และไม่มีคีย์ storage อื่น · updater และ service worker ใช้ Cache API อย่างเดียว
- มีเลขเวอร์ชันย่อยกระจายอยู่ 3 จุด: `wordStatsVersion` = 2, `learn.v` = 2, checkpoint `v` = 1
- ขนาด: เซฟว่าง 2.1 KB · ผู้เล่น 12 วันใน fixture 34 KB

### เก็บอะไร (คีย์บนสุดของ `G.save`)
| คีย์ | เนื้อหา | หมวดใน schema ใหม่ (รอบ 1) |
|---|---|---|
| `settings` | ค่าตั้งทั้งหมด รวม `keybinds`, `hudScale`, `touchLayout` | `settings` |
| `wordStats` | `{ correct, wrong, lastCorrect }` ต่อคำ คีย์เป็น id หรือ `id@zh` | `learning` |
| `wordStatsVersion` | เลขเวอร์ชันย่อยของ wordStats | `learning` |
| `learn` | `{ v, srs, conf, daily{streak,best,last,nextDue,days}, skills, activity, spellRun, why }` | `learning` |
| `customWords` | คำที่ผู้เล่นเพิ่ม แยกตาม level1–3 | `learning` |
| `importedSets` | ชุดคำที่นำเข้า | `learning` |
| `unlockedLevels` | ด่านที่ปลดล็อก | `progress` |
| `levelHighScores`, `dailyHighScores`, `endlessHighScore`, `endlessHighWave` | คะแนนสูงสุด | `progress` |
| `leaderboards` | ตารางอันดับในเครื่อง (ranks) | `progress` |
| `achievements` | รางวัล 15 รายการ (awards) | `progress` |
| `unlockedWeapons` | weapon log | `progress` |
| `notes` | story notes แยกตามด่าน | `progress` |
| `bosses` | `{ seen, defeated }` | `progress` |
| `checkpoints` | `levelN` จาก `G.Checkpoint.snapshot` | `checkpoint` |
| `learnSeen`, `tutorialDone`, `tutorialSeen` | คำแนะนำที่เคยเห็น | `flags` |

- ระเบียน SRS: `{ b, due, last, n, lapses, from? }` — **`last` และ `due` เป็นเลขวัน** ไม่ใช่เวลาจริง
- `tutorialDone`, `tutorialSeen`, `settings.touchLayout` ไม่อยู่ใน `G.defaultSave` (เกมเติมเองตอนใช้) schema ใหม่ต้องประกาศให้ครบ
- ยังไม่มีหมวด `profile` และ `meta`: ไม่มี createdAt, deviceId, เวลาเล่นรวม — **เวลาเล่นรวมยังไม่ถูกนับที่ไหนเลย** เริ่มนับได้ตั้งแต่รอบ 1

### การอ่านและเขียน
- `G.defaultSave` (`core.js:38`) · `G.normalizeSave` (`:147` เติมค่าที่ขาดและซ่อมค่าเสีย ใช้ทั้งตอนโหลดและตอนนำเข้า) · `G.migrateWordStats` (`:283`)
- `G.loadSave` (`:346`) **อ่านแบบ sync** ตอนบูต
- `G.persist` (`:360`) เขียนแบบ sync เขียนไม่สำเร็จแสดงคำเตือน `save.persistFail*` ครั้งเดียว
- `G.persistSoon` (`:375`) debounce 1.2 วินาที และ flush ตอน `pagehide` / `beforeunload` / `visibilitychange` hidden
- ใช้งานจริง: อ้าง `G.save` 302 จุดใน 52 ไฟล์ · `G.persist()` 49 จุด · `G.persistSoon()` 5 จุด
- มีที่อ่านคีย์ตรง ๆ นอก core อีก 2 จุด: `game.js:58` (เช็กการเล่นครั้งแรก → High/Medium) และ `strings.js:31` (`G.earlySettings` เลือกภาษา UI ตั้งแต่ตอน parse ไฟล์)
- ลำดับบูต: `strings.js` กับ `boot.js` ไม่ defer · `game.js:3593` เรียก `G.Game.init` ตอน `DOMContentLoaded` · `G.loadSave` ถูกเรียกจุดเดียวที่ `game.js:59` · handler `DOMContentLoaded` อื่น (strings, abilityui, practice, progress, quiz, checkpoint, updater) ไม่แตะ `G.save` จึงรอเซฟแบบ async ก่อน `G.Game.init` ได้

### ส่งออก / นำเข้า
- `G.exportSave` (`core.js:398`): `{ format:"vocab-zombie-save", version:2, exportedAt, summary, save }` ไฟล์ `vocab-zombie-save-YYYY-MM-DD.json` ผ่าน `<a download>`
- `G.readSaveFile` (`:418`) รับได้ทั้งแบบมีหัวและเซฟเปล่า · `G.applyImportedSave` (`:436`) · `G.saveSummary` (`:388`)
- ปุ่มอยู่ใน Settings → Account (`settings.js` ฟังก์ชัน `account()`) · ไม่มี checksum, ไม่มี snapshot, ไม่มี merge, ไม่มี Web Share
- **ไม่มีปุ่มรีเซ็ตความคืบหน้า** ในเกมตอนนี้ — รอบ 1 ต้องสร้างใหม่ ไม่ใช่แก้ของเดิม

### Checkpoint
- `G.save.checkpoints.levelN` จาก `G.Checkpoint.snapshot` · คืนค่าอัปเกรดเฉพาะ `dmg`, `rate`, `mag` ของ `weaponLevels` (`checkpoint.js:105`) ฟิลด์ใหม่จะไม่ถูกคืนจนกว่าจะแก้จุดนี้

---

## 2. ข้อมูลปืนเดิม

### ไฟล์
- `G.WEAPON_DEFS` ใน `config.js:634` (ด่าน 1 + ปืนหลัก), `:770` (ด่าน 2), `:830` (ด่าน 3) · ชื่อปืนอยู่ใน strings คีย์ `weapon.<id>` · ต้นแบบรูปทรง/เสียงจากคลิปอยู่ใน `gunref.js` (`G.GunRef`)

### จำนวน
- **85 กระบอก**: ด่าน 1 = 33, ด่าน 2 = 26, ด่าน 3 = 26
- archetype: pistol 7, shotgun 11, smg 8, rifle 11, lmg 11, sniper 7, beam 8, launcher 8, cannon 8, energy 6
- rarity: common 15, uncommon 14, rare 20, epic 20, secret 16 (`G.RARITY_ORDER` มี 5 ขั้น)
- ที่มา: เริ่มต้น 1, ลังหรือร้าน 18, ติดผนัง 27, กล่อง standard 28, กล่อง elite 11
- น้ำหนัก: light 12, medium 36, heavy 24, very_heavy 13
- ต้นแบบคลิปอ้างอิง: A 6, B 16, C 8, D 3, E 4, F 2, G 2, H 2, I 1, ไม่มีต้นแบบ 41

### ฟิลด์ที่มีจริง
`id rarity damage fireRate magSize reloadTime auto recoil price(46) color accent level archetype name pellets(11) scope(7) pierce(9) splash(11) splashRadius(11) legendary(1) wallExclusive(27) boxOnly(39) boxTier(39) boxWeight(39) burst(7) burstDelay(7) charge(8) spread(6)` (ตัวเลขในวงเล็บคือจำนวนกระบอกที่มีฟิลด์นั้น)

### การคำนวณที่เกี่ยวกับรอบ 3
- ดาเมจ (`game.js` ประมาณบรรทัด 1039): `def.damage * lvl.dmg` บวก charge, last_round ×3, marksman — **ไม่มีการลดดาเมจตามระยะ**
- spread: `(pellets ? def.spread || .06 : .004) * (aimed ? .5 : 1)` — ไม่มี bloom ไม่มีแยกค่าสะโพกต่อกระบอก
- ยิงหัว `G.HEADSHOT_MULT = 2` ใน `G.ZombieAI.hitMod` (หมวกและเสื้อเกราะของ Ironclad อยู่ที่นี่)
- `G.weaponWeight` คำนวณจากค่าปืน ไม่ได้เก็บเป็นข้อมูล (`entities.js:549`) · `G.WEIGHT_CLASSES` = เกณฑ์ 2.2/3.3/4.4, ความเร็ว 1/.93/.84/.74, stamina 1/1.12/1.3/1.5
- อัปเกรดในร้าน: `player.weaponLevels[id] = { dmg, rate, mag }` ทีละ ×1.15 / ×1.10 / ×1.20 (`game.js` `buyShopItem`) ค่านี้ตามไปกับ `loadout.js` และ checkpoint
- ร้านค้า `G.SHOP_ITEMS`: heal, ammo_refill, dmg_up, firerate_up, mag_up, unlock_shotgun/smg/rifle, crate_common · perk 20 ตัว (`G.PERKS`)

### ต่างจาก prompt
- ไม่มี rarity `legendary` (มี flag `legendary` กระบอกเดียว) แต่ตารางงบความแรงมี 6 ขั้น
- ยังไม่มี: niche tag, fireMode, falloff, ADS time, swap time, bloom, reload แยก tactical/empty, กระสุนสำรองต่อกระบอก, seed แรงถีบ, ชนิดปลอกต่อกระบอก (บางค่าอยู่ใน `G.GunRef`)

---

## 3. ซอมบี้และเวฟ (เกี่ยวกับรอบ 3, 4, 6)

- HP คงที่ต่อชนิด: normal 34, fast 22, crawler 27, bloater 54, ironclad 34, runt 17, abomination 102, screamer 27, headless 37, reacher 61, boss 900 (ตั้งค่าที่ `entities.js:1474`: `this.hp = def.hp`)
- **ไม่มีสูตรเพิ่ม HP ตามเวฟ** เวฟเปลี่ยนจำนวน ความเร็ว สัดส่วน และชนิดผ่าน `G.waveSpec`, `G.WAVE_TABLE` (20 เวฟ, บอสทุก 5 เวฟ) · `currentDiff` (`game.js:603`) เขียนแต่ไม่มีใครอ่าน
- ไม่มีระบบได้ยินเสียง/aggro จากเสียงปืน (มีแค่อีกาใน `G.Details.onShot`) → prompt ข้อ 5.3 ให้ข้ามการลดรัศมี aggro
- ท่าโดนตีมีแล้ว: flinch, stagger, down ใน `zombieai.js`, `zombieanim.js`
- Bloater: มี fuse "swell" ใน `zombiefx.js:563` และระเบิดผลัก `zombieai.js:224`
- Blood & Gore: `settings.gore` = full/reduced/off, `G.ZombieFactory.gore({type})` (Runt เป็น reduced เสมอ)

---

## 4. ระบบมีด / quick melee

- `G.MELEE_DEF = { id:"melee", damage:35, fireRate:450, range:2.6 }` (`config.js:890`) อาวุธเดียว
- `currentSlot` 0 = มีด · ปุ่ม `melee: "Digit1"` แค่สลับไปช่อง 0 · **ไม่มี quick melee** · controller ปุ่ม B ก็แค่ `switchSlot(0)` (`gamepad.js:67`)
- WSM: `startMelee` (`weaponsm.js:307`), config `weaponSM.melee { hit:.10, dur:.45 }`, event `weapon:melee`
- `meleeAttack` (`game.js:1252`): เป้าเดียว, เช็กมุมด้วย dot > .7, **ไม่เช็กผนัง (ฟันทะลุผนังได้)**, ไม่มีหัว, ไม่ใช้ stamina
- `G.Bosses.melee` (บอส), `G.buildMeleeMesh` (โมเดล)
- touch ยังไม่มีปุ่ม melee: `G.TouchCfg` `IDS` = joystick, fire, ads, interact, reload, jump, sprint, pause, abilities (`touchcfg.js:17`) ช่องมีดบน HUD แตะแล้วสลับ

---

## 5. ระบบคำถาม / SRS

- `G.CONFIG.srs`: intervals [1, 3, 7, 14, 30], masteredEvery 60, recognitionMaxBox 3
- ตอบคำ: `G.Learning.answerWord(pair, right, { recall, assisted, typed, picked, inView, skills })` — ใช้ทางเดียวนี้เสมอ `assisted` คือใช้คำใบ้
- `G.SRS.*`, `G.WavePlan` (คุมคำใหม่ต่อเวฟ)
- `G.Questions` 8 แบบ + 3 แบบพิเศษ · `G.QuestionView.fill` · `G.Game.startWordChallenge(label, onSuccess, onFail, opts)` (`game.js:1888`) · `G.Quiz` (6 ข้อ)
- คำอธิบาย: `G.Explain`, `G.ExplainView`, `G.ExplainCard`
- คลังคำ 886 รายการ (283 / 298 / 305) ฟิลด์: `id headword partOfSpeech acceptedSpellings thai zh pinyin zhPos fr frPos frGender definition synonyms examples collocations family topic level source stress` (บางคำมี `awlSublist`) หัวข้อ 12 หมวด
- `family` = รายการรูปคำ `{ word, pos }` ต่อคำ ไม่มีรหัสตระกูล

### ต่างจาก prompt
- **ไม่มี CEFR ที่ไหนเลย** ฟิลด์ `level` คือด่านในเกม — กระทบ Word Forge ข้อ 3 และคำฝึกด่านสอน
- SRS ใช้ `last` เป็นเลขวัน ไม่ใช่ `lastReviewedAt` — กระทบกติกา merge ถ้าเลขวันเท่ากันต้องมีตัวตัดสินเพิ่ม
- "word family ครบ" ไม่มีนิยาม

---

## 6. Event Bus

- `G.Bus.on / off / emit` (`bus.js`) sync · `recent` เก็บ 10 รายการ · ไม่มี wildcard
- event ที่มีตอนนี้ทั้งหมด: `player:hurt`, `weapon:aim`, `weapon:dryfire`, `weapon:fire`, `weapon:inspect`, `weapon:lowered`, `weapon:melee`, `weapon:noreserve`, `weapon:reload`, `weapon:state`, `weapon:switch`, `weapon:visible`
- ต่างจาก prompt: รอบ 2 ต้องการ 50 รายการล่าสุด และภาพรวมเกม ซึ่ง bus ตอนนี้มีแค่ฝั่งอาวุธ

---

## 7. HUD

- `hud.js` (DOM), `hudcfg.js` (ปรับตำแหน่ง/ขนาด), ข้อมูลจาก `buildHudState` ใน `game.js`
- ช่องอาวุธกลางล่าง · แถบ HP %, stamina · ช่องมีดใช้คีย์ `hud.slotKnife` (ตายตัว รอบ 4 ต้องเปลี่ยนเป็นชื่ออาวุธจริง)
- `ui.js:1126` และ `perf.js:524` อ่าน `renderer.info` · `debug.js` overlay ขึ้นเมื่อ `?debug=1` แสดงเวลาเฟรมแบบค่าเฉลี่ย ไม่มีประวัติ FPS และ 1% low
- ตัววินิจฉัยเดิม: `window.addEventListener("error")` ตัวเดียว (`index.html:762`) · ไม่มี `unhandledrejection` · toast ใช้ `G.UI.flashPurchaseBanner`
- ตรวจอินพุตล่าสุด: `G.Input.mode` (touch/ปกติ), `G.isHandheld()` (`core.js:587`), `G.Pad` — ยังไม่มีตัวแปรเดียวบอก keyboard/controller/touch ล่าสุด (รอบ 2 และ 7 ต้องใช้)

---

## 8. เมนู WEAPONS / AWARDS / HELP

- เมนูหลัก (`mainmenu.js`) 4 กลุ่ม: play (play, review) · learn (progress, vocab, notes, custom) · collect (weapons, bosses, ranks, awards) · system (settings, help)
- WEAPONS → `screen-weaponlog` (`UI.renderWeaponLog`) · AWARDS → `screen-achievements` · HELP → `screen-howtoplay`
- แถบผู้เล่น `home-signin` และ `G.Account.state()` พร้อมรับรอบบัญชี (`account.js` เป็นตัวแทน ยังไม่มีบัญชีจริง) · ยังไม่มีเมนู PROFILE
- Pause (`index.html:669`): resume, vocablog, weaponlog, journal, settings, tutorial, mainmenu
- Settings (`settings.js:33`) 8 หมวด: graphics, audio, controls, gameplay, language, accessibility, account, about — **ยังไม่มี Data, Help/Support, Tips**
- โมดัลกลาง: `G.Modal.open(id, { freeze|pause, keys }) / close(id)` และ `G.Dialog` (ใน prompt เรียก openModal/closeModal)
- `G.Tutorial` (การ์ดสอนตามจังหวะ) · `tips.js` คือ tooltip ไม่ใช่คำแนะนำในเกม
- ความเป็นส่วนตัว: `btn-privacy` ใน Settings → About · หน้าต่าง "มีอะไรใหม่" มีแล้วใน `updater.js` (`changesSince`) สำหรับตอนอัปเดต
- Lab: `?lab=weapons`, `?lab=sound`, `?lab=zombies` (`js/lab/*`) โหลดผ่าน `debug.js`

---

## 9. การวาง wall gun และ mystery box

- ปืนติดผนัง: `mountWallGun(id, mx, y, mz, facingWest)` (`world.js:983`) ผลอยู่ที่ `world.wallWeapons`, ซื้อด้วย `buyWallWeapon` (`game.js:3292`)
- ตำแหน่งมาจาก `spec.gun` ของแต่ละห้อง (`world.js:1419`) ตารางห้อง: โรงเรียน `:1896–1922`, โรงพยาบาล `:1961–1976`, บังเกอร์ `:2005–2020` และปืนลับในฉากจบ `:2144 / :2200 / :2257`
- ลัง: `openCrate` (`game.js:1627`) · กล่องปริศนา: `openMysteryBox` (เรียกที่ `game.js:2969`), `G.MYSTERY_BOX_COST = 1250`
- `G.Loadout.offer`, `spawnFloorGun` คุมการรับปืนเข้าช่อง

### ห้องที่มีจริงสำหรับรอบ 4 และ 6
| ด่าน | ห้องจริงในโค้ด |
|---|---|
| โรงเรียน | `sports` (ห้อง E7 ป้าย PE Store ตรงกับห้องเก็บอุปกรณ์พละ), `storeroom` (E4, PW5), `science` (E2), `chemistry` (PW6), สวนดอกไม้แห้ง (GARDEN ใน `campus.js`) |
| โรงพยาบาล | `furnish`: ward, storage, office, lab, theatre, morgue, reception |
| บังเกอร์ | `furnish`: storage, armoury, office, control, barracks, generator, cells, lab |

---

## 10. สภาพแวดล้อมและเครื่องมือ

- Three.js r128, สคริปต์ธรรมดาบน global `G`, Cloudflare Workers static assets, PWA
- API ที่ตรวจแล้วว่ามีใน Edge เครื่องนี้: `navigator.storage.persist`, `estimate`, IndexedDB, `CompressionStream`, `navigator.canShare`, `Intl.Segmenter` — **ยังไม่ได้ตรวจบน iPad** ต้องเขียนทางสำรองทุกตัว
- `serve-lan.ps1:90` map แค่ `/tools/` ส่วน `/tests/` ยังเปิดจากเบราว์เซอร์ไม่ได้ (รอบ 1 ต้องเพิ่ม)
- เครื่องนี้ไม่มี Node
- ชุดทดสอบ `tools/round1..29-test.js` · `tools/dev/` คือสคริปต์คุม Edge headless ที่ย้ายมาจาก temp ในรอบนี้
- ก่อนเริ่มรอบนี้ ชุด 1–29 ผ่านหมด ยกเว้น 2 จุดที่มีมาก่อน: ชุด 22 "gate under 150 draw calls" (โลกแกว่ง 136–151 ตามจังหวะโหลด ไม่ผ่านบน `4781987` ด้วย) และชุด 16 ข้อจังหวะเวลา/สุ่ม 3 ข้อ (พลาดคนละข้อในแต่ละรอบ และแต่ละข้อเคยผ่าน)

---

## 11. Fixture เซฟ

`tests/fixtures/save-v-current.json` (34,609 ไบต์) สร้างด้วย `tools/make-save-fixture.js`

- เป็นรูปแบบเดียวกับที่ `G.save` ถืออยู่ (เซฟเปล่า ไม่ใช่ไฟล์ export ที่มีหัว) ผ่าน `G.normalizeSave` แล้วไม่มีค่าใดเปลี่ยนเลย (`r.changed` ว่าง)
- ผู้เล่นจำลอง 12 วัน สร้างด้วยฟังก์ชันจริงของเกม ไม่มีข้อมูลผู้เล่นจริง: 129 คำ, กล่อง SRS 125 คำ, checkpoint เวฟ 11 จากรอบเล่นจริง, คำคีย์ `@zh`, `touchLayout`, คำ custom, ชุดนำเข้า
- ทดสอบบูตจริง: วางลง localStorage แล้วรีโหลด เกมเปิดถึงเมนูหลัก ค่าทุกฟิลด์ตรงกับไฟล์ ยกเว้น `graphicsQuality` ที่ตั้งใจเปลี่ยนเป็น low สำหรับเครื่องนี้ · checkpoint เจอ, notes 7, คำถึงกำหนด 45, streak 2, สรุป `{ levels:2, words:129, achievements:5, weapons:7, bestScores:2 }`
- ไฟล์เป็น ASCII ล้วน (ภาษาอื่นเป็น `\u` escape) เพื่อให้ `thai-scan` ผ่าน
