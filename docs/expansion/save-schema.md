# Save schema (รอบ 1)

โค้ด: `public/js/savemanager.js` (ที่เก็บ, migration, snapshot), `public/js/savefile.js` (ไฟล์, merge), `public/js/dataui.js` (หน้าจอ)
ค่าที่ปรับได้: `G.CONFIG.save` ใน `public/js/config.js`

## 1. ภาพรวม

- **ในหน่วยความจำ**: `G.save` แบบแบนเหมือนเดิม โค้ดเกมทุกจุดอ่านเหมือนเดิม
- **ตอนเก็บและส่งออก**: เอกสารเดียวมี `schemaVersion` แบ่งหมวด แปลงด้วย `toDoc` / `fromDoc`
- `schemaVersion` ปัจจุบัน = **2** · เวอร์ชัน 1 คือเซฟแบบแบนของเดิม

## 2. หมวดและฟิลด์

| หมวด | คีย์ใน `G.save` | เนื้อหา |
|---|---|---|
| `profile` | `profile` | `{ name, avatar, publicId }` ว่างจนกว่าจะถึงรอบบัญชี |
| `settings` | `settings` | ค่าตั้งทั้งหมด รวม `keybinds`, `hudScale`, `touchLayout` (ไม่บังคับ มีเมื่อใช้ touch), `showDrawCalls` (ไม่บังคับ) |
| `learning` | `wordStats`, `wordStatsVersion`, `learn`, `customWords`, `importedSets` | สถิติคำ, SRS, คู่คำที่สับสน, streak, ประวัติสาเหตุที่ผิด, คำของผู้เล่น |
| `progress` | `unlockedLevels`, `levelHighScores`, `dailyHighScores`, `endlessHighScore`, `endlessHighWave`, `leaderboards`, `achievements`, `unlockedWeapons`, `notes`, `bosses`, `attach` | ด่าน คะแนน ranks awards weapon log story notes บอส อุปกรณ์เสริมและสกิน (รอบ 5) |
| `checkpoint` | `checkpoints` | `{ level1, level2, level3 }` รูปแบบเดิมของ `G.Checkpoint.snapshot` |
| `flags` | `learnSeen`, `tutorialDone`, `tutorialSeen` | สถานะการสอนและคำแนะนำที่เคยเห็น |
| `meta` | `meta` | ดูด้านล่าง |
| `other` | คีย์ที่ไม่มีหมวด | กันข้อมูลหาย ถ้ารอบถัดไปเพิ่มคีย์แล้วยังไม่ได้จัดหมวด |

### `meta`

| ฟิลด์ | ความหมาย |
|---|---|
| `createdAt` | เวลาเริ่มเซฟ (ms) เซฟเก่าใช้วันแรกที่มีใน `learn.activity` |
| `updatedAt` | เวลาเขียนล่าสุด (ms) |
| `rev` | ตัวนับจำนวนครั้งที่เขียน ใช้ตัดสินว่าสำเนาไหนใหม่กว่า ไม่พึ่งนาฬิกาเครื่อง |
| `deviceId` | รหัสสุ่ม 16 ตัวอักษรของเครื่องนี้ ไม่เกี่ยวกับตัวผู้เล่น |
| `gameVersion` | เวอร์ชันเกมตอนเขียนล่าสุด |
| `playSec` | เวลาเล่นรวม (วินาที): ในด่าน ร้านค้า และหน้า Practice ไม่นับตอน pause |
| `lastExportAt` | เวลาส่งออกไฟล์ล่าสุด |
| `exportMark` | จำนวนคำตอบสะสมตอนส่งออก ใช้ดูว่ามีความคืบหน้าใหม่หรือไม่ |
| `nudgeAt` | เวลาเตือนสำรองครั้งล่าสุด |

### ระเบียนย่อยที่สำคัญ

- `learn.srs[key]`: `{ b, due, last, n, lapses, from? }` · `due` และ `last` เป็น **เลขวัน** (`G.Clock.today()`) ไม่ใช่เวลาจริง
- `wordStats[key]`: `{ correct, wrong, lastCorrect }` · `key` คือ id ของคำ หรือ `id@zh`, `id@fr`, `id@th`
- `learn.conf[Y][X]`: `{ n, ok, off }`
- `learn.daily`: `{ streak, best, last, nextDue, days }`
- `learn.why[key]`: `[{ d, c, x, t }]` เก็บล่าสุดไม่เกิน `G.CONFIG.explain.history`
- `customWords.levelN`: `[word, meaning, extra?]`
- `attach` (รอบ 5, `public/js/attachments.js`): `{ v: 1, unlocked, loadout, family, forms, spellBest, bossesBest }`
  - `unlocked[id]`: เลขวันที่ปลดล็อก · `id` คือ id ของอุปกรณ์ (`reddot`) หรือ `skin:<key>` (`skin:lexicon`) · ปลดล็อกแล้วอยู่ถาวร
  - `loadout[gunId]` และ `family[family]`: `{ optic?, muzzle?, mag?, grip?, skin? }` ของปืนกระบอกนั้น หรือค่าเริ่มต้นของทั้งตระกูล (ปืนที่ไม่มีของตัวเองใช้ของตระกูล)
  - `forms[entryId]`: รูปคำในตระกูลคำที่เคยตอบถูกโดยไม่ใช้คำใบ้ (ตัวพิมพ์เล็ก ไม่เกิน 16 รูปต่อคำ) ใช้นับ "ตระกูลคำครบ"
  - `spellBest`: สะกดถูกติดกันมากที่สุดที่เคยทำได้ · `bossesBest`: บอสมากที่สุดที่ชนะในรอบเดียว
  - เซฟเก่าที่ไม่มีคีย์นี้ได้ชุดว่าง (`G.Attach.normalize`) · id ที่ไม่รู้จักหรือใส่ผิดช่องถูกตัดทิ้ง
  - merge: `unlocked` รวมทั้งสองฝั่ง (เลือกวันที่เก่ากว่า) · `loadout`/`family` ใช้ของเครื่องนี้ก่อน ฝั่งไฟล์เติมเฉพาะปืนที่เครื่องนี้ไม่มี · `forms` รวมกัน · `spellBest`/`bossesBest` เอาค่ามากกว่า
  - ระบบนี้อ่าน `learn` อย่างเดียว ไม่เขียนกลับ
- `checkpoints.levelN` (รอบ 6 เพิ่ม, `public/js/forge.js`): ขั้น Word Forge เป็นของรอบเล่น จึงอยู่แค่ใน checkpoint ไม่มีคีย์ใหม่ระดับบนสุด
  - `player.weaponLevels[gunId]`: เพิ่ม `tier` (1-3), Tier III เพิ่ม `pierce` (จำนวนตัวที่ทะลุเพิ่ม) หรือ `head` (ตัวคูณยิงหัว) ส่วนแม็กใหญ่ขึ้นอยู่ใน `mag` เดิม · `dmg` นับขั้นรวมไว้แล้ว (คูณกับอัปเกรดร้านค้า)
  - `forge`: `{ cooldown: {gunId: wave}, used: [wordKey], tries }` ปืนที่สอบไม่ผ่านรอจนจบเวฟนั้น และคำที่ถามไปแล้วในรอบนี้ (ไม่เกิน 400)
  - checkpoint เก่าที่ไม่มีฟิลด์เหล่านี้: ไม่มีขั้น ไม่มีการรอ (`G.Checkpoint.apply` และ `G.Forge.restore` ตรวจค่าทุกตัว)
- `tutorialSeen.forge_scene` (รอบ 6): เคยดูฉากอัปเกรดจนจบแล้ว ครั้งต่อไปกดข้ามได้ · อยู่ในหมวด `flags` เดิม

## 3. ที่เก็บ

| ที่ | คีย์ | รูปแบบ | หน้าที่ |
|---|---|---|---|
| IndexedDB `vocabZombie`, store `kv` | `main` | `{ id, schemaVersion, rev, updatedAt, json }` | ที่เก็บหลัก เขียนใน transaction เดียว |
| IndexedDB store `kv` | `rescue` | `{ id, at, json }` | ข้อมูลที่อ่านไม่ได้ เก็บไว้ตามเดิม |
| IndexedDB store `snapshots` | `id` (เวลา ms) | ดูหัวข้อ 5 | ข้อมูลสำรองอัตโนมัติ |
| localStorage | `vocabZombie_save_v1` | เซฟแบบแบน + `meta` | สำเนา sync |
| localStorage | `vocabZombie_save_rescue` | ข้อความดิบ | สำรองของ `rescue` |
| localStorage | `vocabZombie_snapshots` | JSON array | ใช้เมื่อไม่มี IndexedDB เท่านั้น สูงสุด 2 ชุด |

สำเนาแบบแบนยังเขียนต่อทุกครั้ง เพราะ:
1. เขียนเสร็จแน่นอนตอน `pagehide` ส่วน IndexedDB อาจไม่ทัน
2. `strings.js` ต้องอ่านภาษาแบบ sync ตั้งแต่ก่อนบูต
3. ถอยเวอร์ชันเกมด้วย `git revert` แล้วอ่านต่อได้ทันที

### เลือกสำเนาตอนบูต

1. อ่านทั้งสองที่ รอ IndexedDB ไม่เกิน `bootWaitMs`
2. ใช้ `rev` สูงกว่า · เท่ากันใช้สำเนาแบบแบน เพราะเขียนก่อนเสมอ และเกมเวอร์ชันเก่าอาจเขียนคีย์นี้โดยไม่เพิ่ม `rev`
3. สำเนาที่เสียหายถูกข้ามไปใช้อีกสำเนา
4. สำเนาจากเกมเวอร์ชันใหม่กว่าใช้ไม่ได้ แต่เก็บเข้า `rescue` ก่อน ไม่ถูกเขียนทับ
5. IndexedDB ตอบช้าเกินกำหนด: ใช้สำเนาแบบแบน ถ้าคำตอบที่มาทีหลังมี `rev` สูงกว่า เก็บเป็น snapshot `late`
6. อ่านไม่ได้ทั้งสองสำเนา: เกมเปิดด้วยเซฟว่าง **ไม่เขียนอะไรลง storage** และถามผู้เล่น (ส่งออกข้อมูลดิบ / เริ่มใหม่)

### จังหวะเขียน

- `G.persist()` และ `G.persistSoon()`: เขียนภายใน `debounceMs` (2 วินาที)
- `G.persist(true)`: เขียนทันที ใช้กับ checkpoint, จบด่าน, ก่อนอัปเดตเกม
- `pagehide`, `beforeunload`, `visibilitychange` hidden: เขียนทันที
- เนื้อหาไม่เปลี่ยน: ไม่เขียน

## 4. Migration

- `MIGRATIONS[n]` แปลงจากเวอร์ชัน n ไป n + 1 เรียงตามลำดับ ขั้นที่ปล่อยไปแล้วห้ามแก้ ให้เพิ่มขั้นใหม่
- ขั้นตอนแปลงแค่ย้ายข้อมูล `G.normalizeSave` เป็นตัวเติมค่าที่ขาดและซ่อมค่าเสียหลังจากนั้น
- บูตครั้งแรกหลังอัปเดต: เก็บข้อความเซฟเดิมเป็น snapshot `migration` ก่อน
- แปลงไม่สำเร็จ: ไม่เขียนทับ เก็บต้นฉบับ แสดงข้อผิดพลาด ส่งออกข้อมูลดิบได้

`tests/fixtures/save-v-current.json` คือเซฟรูปแบบเก่าที่บันทึกไว้เป็นหลักฐาน **ห้ามสร้างใหม่ทับ**

## 5. Snapshot

เก็บสูงสุด `snapshots` ชุด (7) ลบชุดเก่าสุดก่อน

```
{ id, reason, day, rev, gameVersion, schemaVersion, summary, json }
```

| `reason` | เมื่อไร |
|---|---|
| `daily` | วันละครั้ง เมื่อมีความคืบหน้าและต่างจากชุดล่าสุด |
| `migration` | บูตครั้งแรกหลังเปลี่ยนรูปแบบ |
| `import` | ก่อนนำเข้าแบบแทนที่ |
| `merge` | ก่อนรวมเซฟ |
| `restore` | ก่อนกู้คืน |
| `reset` | ก่อนรีเซ็ต |
| `late` | สำเนาใหม่กว่าที่มาถึงหลังบูต |

`summary` คือ `G.saveSummary`: `{ levels, words, remembered, achievements, weapons, bestScores, playSec }` · `remembered` นับคำกล่อง ≥ `rememberedBox` (4)
รอบ 8 เพิ่ม `reason` สำหรับการเชื่อมบัญชี

## 6. ไฟล์ `.vzsave`

ชื่อไฟล์ `vocab-zombie-save-YYYYMMDD-HHMM.vzsave` เนื้อหาเป็น JSON:

```json
{
  "header": {
    "app": "vocab-zombie",
    "schemaVersion": 2,
    "gameVersion": "2026.11.04-1200",
    "exportedAt": "2026-11-04T12:00:00.000Z",
    "deviceLabel": "iPad · Safari",
    "compressed": "gzip",
    "checksum": "<sha-256 hex>"
  },
  "payload": "<ข้อความ>"
}
```

- `compressed: "gzip"`: `payload` คือ base64 ของเอกสารที่บีบด้วย gzip · `compressed: false`: `payload` คือเอกสาร JSON ตรง ๆ
- `checksum` คือ SHA-256 ของข้อความ `payload` ตามที่อยู่ในไฟล์
- SHA-256 เขียนเองใน `savefile.js` เพราะ `crypto.subtle` ใช้ได้เฉพาะ https/localhost แต่เกมเปิดผ่าน LAN แบบ http ได้ด้วย ทดสอบเทียบกับ `crypto.subtle` แล้ว
- `deviceLabel` บอกแค่ชนิดเครื่องและเบราว์เซอร์
- นำเข้าไฟล์ `.json` รุ่นเก่าได้ทั้งแบบมีหัว `format` และเซฟเปล่า

ข้อความปฏิเสธไฟล์: `save.errJson`, `save.errNotSave`, `save.errApp`, `save.errChecksum`, `save.errNewer`, `save.errGzip`, `save.errCorrupt`

## 7. กติกา merge

`G.SaveFile.merge(here, there, { useFileSettings })` · `here` = เครื่องนี้, `there` = ไฟล์ · รอบ 8 ใช้ซ้ำ

| ข้อมูล | กติกา |
|---|---|
| SRS ต่อคำ | ระเบียนที่ `last` ใหม่กว่า · วันเดียวกันใช้ `n` มากกว่า แล้ว `b` มากกว่า · `last` เป็น null ถือว่าเก่าสุด |
| `wordStats`, `conf`, `skills`, `activity`, `spellRun`, จำนวนบอส, คะแนนสูงสุด | ค่ามากกว่าทีละฟิลด์ (`conf.off`: จริงถ้าฝั่งใดฝั่งหนึ่งจริง) |
| Daily Review | `streak`, `last`, `nextDue` ตามฝั่งที่ทบทวนล่าสุด (วันเดียวกันใช้ streak มากกว่า) · `best` ค่ามากกว่า · `days` รวมกัน |
| `why` | รวมกัน ตัดซ้ำ เรียงวัน เก็บล่าสุดตาม `explain.history` |
| ด่าน ปืน รางวัล notes flags | รวมกัน |
| `leaderboards` | รวมกัน ตัดรายการซ้ำ เรียงคะแนน เก็บ 10 อันดับ |
| `customWords` | รวมกัน คำเดียวกัน (ภาษา + ตัวสะกดไม่สนตัวพิมพ์) นับครั้งเดียวทุกด่าน ถือของเครื่องนี้ |
| `importedSets` | รวมตาม id ถือของเครื่องนี้ · เนื้อหาเดียวกันคนละ id ไม่เพิ่มซ้ำ |
| `settings` | ของเครื่องนี้ หรือของไฟล์ถ้าติ๊กเลือก |
| `checkpoints` | ต่อด่าน `savedAt` ใหม่กว่า |
| `profile` | ของเครื่องนี้ ถ้าว่างใช้ของไฟล์ |
| `meta` | ของเครื่องนี้ ยกเว้น `createdAt` ใช้ค่าเก่ากว่า และ `playSec` ใช้ค่ามากกว่า |

streak ไม่ได้ใช้ "ค่ามากกว่า" ตามกติกาตัวนับ เพราะเป็นสถานะที่ผูกกับวันทบทวนล่าสุด ถ้ารวมแบบค่ามากกว่าจะได้ streak ที่ไม่จริง และรอบ 5 ใช้ค่านี้ปลดล็อกของ
