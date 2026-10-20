# Audio Event Map (ออกแบบรอบ 0 · ลงมือรอบ 3)

## 1. ของเดิม (สำรวจจากโค้ด ณ `2dfc582`)

| ส่วน | ที่อยู่ | สภาพ |
|---|---|---|
| Context + bus | `audio.js` `G.Audio.unlock()` | bus `sfx` (×0.9), `music` (×0.42), `ambient` (×0.55) → `DynamicsCompressor` → destination; speech ผ่าน `SpeechSynthesis` แยก (ไม่ผ่าน Web Audio) |
| ปลดล็อก iOS | `audio.js` `unlock()` เรียกจากทุก gesture | **คง** |
| Voice guard | `_voiceGuard`: เพดานรวม 64, นับลดด้วย `setTimeout`, `PRIORITY_SFX` ข้ามเพดาน | ไม่มีเพดานต่อหมวด ไม่มี steal |
| Spatial | `_out(bus, pos)`: `PannerNode` equalpower, inverse, listener ตามกล้อง (`updateListener`) | ไม่มี HRTF, ไม่มี occlusion |
| เสียงปืน | `gunaudio.js` `G.GunAudio`: 85 กระบอก family + seed, transient/body/tail/mech, `reloadEvent(kind)`, `swap(from,to,dur)`, charge hum | สังเคราะห์สดทุกนัด (ไม่มี pre-render), pitch ±4% |
| Reverb | `gunaudio.js` `ENV` 4 แบบ (room 0.55 s, corridor 1.0 s, hall 2.2 s, outdoor 0.7 s) จาก `envForRegion(ชื่อ region)` → ConvolverNode ต่อแบบ (cache, ไม่สร้างซ้ำ) crossfade `setTargetAtTime` τ 0.25 s | ส่งเข้า reverb เฉพาะเสียงปืน, ยังไม่มี underground/warehouse, ไม่มี tier |
| ฝีเท้า | `game.js` → `G.PlayerBody.takeSteps()` (ซิงก์เท้าบนจอแล้ว) → `G.Audio.footstep(surface, running)` | surface มี 3 แบบ: tile, grass (`YARD*`), metal (บังเกอร์) |
| ซอมบี้ | `G.Audio.zombie(kind, type, pos)` growl ตามเวลาสุ่มในระยะ 32 m | 3 ชนิด, ไม่มี horde bed, ไม่มีฝีเท้าซอมบี้ |
| บอส / cutscene | `boss()`, `bossVoice()`, `bossLoop()`, `bossMusic()`, `cine()`, `cineBed()` | **คง** เสียงเดิม ย้ายเข้า bus ใหม่เท่านั้น |
| UI | `sfx("correct"/"wrong"/"tick"/"purchase"/"unlock"...)` บน bus sfx | ไม่มี bus UI แยก, ไม่มี hover/back |
| ด่าน / เมนู | `startLevel(theme)` drone + ambient bed + one-shot, `menuMusic(on)` | **คง** + ปรับเข้า mixer |

ปัญหาที่ต้องแก้: เสียงที่ตั้งเวลาล่วงหน้าด้วย `at:` (เช่น `GunAudio.swap`) ไม่หยุดเมื่อ pause และยกเลิกไม่ได้ · ไม่มีเสียง UI ระหว่าง pause แยกจากเกม · ฝีเท้า/กระทบใช้ surface คนละชุด

## 2. Mixer ใหม่

```
Master (gain) → Compressor (เดิม) → Limiter (DynamicsCompressor ratio 20, threshold −1 dB, attack 1 ms) → destination
  ├─ Music      (ducking: −6 dB, attack 0.1 s, release 0.8 s)
  ├─ Weapons    (ใหม่: ปืนผู้เล่น, รีโหลด, สลับ)
  ├─ SFX        (ซอมบี้, กระทบ, ฝีเท้า, ประตู, ของเก็บ)
  ├─ Ambient    (ducking: −4 dB)
  ├─ UI         (ใหม่: ไม่ถูก mute ตอน pause)
  └─ Reverb return A/B (รับ send จาก Weapons + SFX)
```

- Pause: ramp gain ของ Weapons/SFX/Ambient → 0 ใน 0.08 s และหยุด one-shot ที่ผูก instanceId; Music ลด −6 dB; UI ทำงานต่อ
- Ducking triggers: `boss:telegraph`, `cutscene:start`, `ui:open` ของ popup คำถาม
- Settings ใหม่ (ค่าเดิมคงไว้): `masterVolume`, `weaponsVolume`, `uiVolume` + เดิม `musicVolume`, `sfxVolume`, `ambientVolume`, `speechVolume` — migration: weapons/ui เริ่มที่ค่า `sfxVolume` เดิมของผู้เล่น

## 3. Event → เสียง

Priority (สเปก 3.9): **1** ต้องได้ยิน · **2** เคลื่อนไหว/กลไก · **3** สิ่งแวดล้อม · **4** เพลง
Voice limit ต่อหมวด (ค่าเริ่มต้น): ปืนผู้เล่น 6 · กระทบ 8 · ซอมบี้ 6 + horde bed · ฝีเท้า 6 · UI 4 · ambient 4 · เพดานรวมตาม tier (16/20/24/32/40) — เกินแล้ว steal ตัว priority ต่ำสุด ถ้าเท่ากันเอาตัวไกลสุด แล้วตัวเก่าสุด

| Event (G.Bus) | ชั้น / recipe | Bus | Prio | หมวด (limit) | Cooldown / กันซ้ำ |
|---|---|---|---|---|---|
| `weapon:fire` | transient + body + mech (ซิงก์สไลด์) + tail send + distant (Ultra, outdoor/hall) — recipe ต่อตระกูล + พารามิเตอร์ต่อกระบอก (seed เดิม) จาก buffer pre-render 2–6 variants ตาม tier | Weapons | 1 | ปืนผู้เล่น (6) | 1 ชุดต่อ `shotId`; variant ห้ามซ้ำติดกัน; pitch ±3%, gain ±1 dB |
| `weapon:dryfire` | คลิกแห้ง | Weapons | 1 | ปืนผู้เล่น | 1 ครั้งต่อการกดไก |
| `weapon:lowammo` | ติ๊กเตือนเบา | UI | 1 | UI (4) | ครั้งเดียวเมื่อข้ามเกณฑ์ (≤ 25% แม็ก) |
| `weapon:noreserve` | เสียงปฏิเสธสั้น + ข้อความ HUD | UI | 1 | UI | 0.6 s |
| `weapon:reload` marker `start` | ผ้า/จับปืน (เบา) | Weapons | 2 | ปืนผู้เล่น | 1 ต่อ `reloadId:marker` |
| marker `magOut` / `magIn` / `magSlap` / `boltRelease` / `shellIn` / `pump` / `coverOpen` / `coverClose` | ชุดต่อตระกูล (โลหะเลื่อน+คลิก / คลิกหนัก / โลหะคม) จาก `reloadEvent` เดิม | Weapons | 2 | ปืนผู้เล่น | เหมือนบน, `silent` = ไม่เล่น |
| marker `end` | ยืนยันสั้น | Weapons | 2 | ปืนผู้เล่น | — |
| `weapon:reload cancel` | หยุด/เฟด 60 ms เสียงที่ผูก `reloadId` | — | — | — | — |
| `weapon:switch lower` / `raise` | holster / draw (แยกจาก `swap()` เดิม เล่นตาม marker แทนตั้งเวลา) | Weapons | 2 | ปืนผู้เล่น | ต่อ `switchId` |
| `weapon:aim` | ผ้าเบา | Weapons | 2 | ปืนผู้เล่น | 0.25 s |
| `weapon:inspect` | ผ้า/กลไกเบา | Weapons | 2 | ปืนผู้เล่น | ต่อ `inspectId` |
| `weapon:melee start` / `hit` | swish / ฟันโดน (เนื้อ/พื้นผิว) | Weapons | 1 | ปืนผู้เล่น | ต่อ `meleeId` |
| `hit:impact` | ตาม surfaceType (9 แบบ) | SFX | 2 | กระทบ (8) | ลูกซอง: รวมเม็ดเป็นเสียงเดียวต่อ surface ต่อนัด; ระยะ > 40 m ไม่เล่น |
| `zombie:hurt` (headshot) | `headshot` เดิม + เนื้อ | SFX | 1 | ซอมบี้ (6) | 0.08 s ต่อซอมบี้ |
| `zombie:idle` / `zombie:move` | เสียงประจำชนิด (formant + noise + osc) ใกล้/ไกล (ไกล = lowpass + reverb มากขึ้น) | SFX | 3 | ซอมบี้ (6) | ต่อตัว 2–8 s สุ่ม (เดิม) |
| `zombie:attack` (ท่าเตรียม) | คำราม/หายใจแรง ก่อนโจมตี | SFX | 1 | ซอมบี้ | ต่อการโจมตี |
| `zombie:special` | Bloater บวม, Screamer กรีดร้อง (คุม peak + caption), Ironclad หมวกกระเด็น | SFX | 1 | ซอมบี้ | ต่อ instance; ยกเลิกเมื่อตายระหว่างตั้งท่า |
| `zombie:step` | ฝีเท้าตาม surface เฉพาะ 3 ตัวที่ใกล้สุด | SFX | 3 | ฝีเท้า (6) | ต่อก้าว |
| horde bed (ต่อเนื่อง) | ครางซ้อน + เดินซ้อน gain ตามจำนวนซอมบี้ใน 15 m | SFX | 3 | 1 loop | ปรับ gain ทุก 0.25 s |
| `player:step` / `land` / `jump` | ตาม surfaceType 7 แบบ, วิ่ง ≠ เดิน (ของเดิม `takeSteps()`) | SFX | 2 | ฝีเท้า | ต่อก้าว |
| `player:hurt` / HP ต่ำ | `hurt` / heartbeat เดิม | SFX | 1 | — (priority list) | ของเดิม |
| `door:*` (ประตูเลื่อน) | `slideDoor`, `doorStop` เดิม | SFX | 2 | SFX อื่น | ของเดิม |
| `ui:hover` | คลิกเบา (ไม่มีบน touch) | UI | 2 | UI (4) | ครั้งเดียวต่อการเข้าปุ่ม |
| `ui:select` / `ui:open` / `ui:back` | ยืนยัน / เปิด / ย้อนกลับ (ต่างกันชัด) | UI | 1 | UI | 0.05 s |
| `quiz:answer` | `correct` / `wrong` เดิม | UI | 1 | UI | ต่อคำตอบ |
| `ambient:*` | bed + one-shot ต่อ theme เดิม (+ ป่า) ตำแหน่งจริงในโลก | Ambient | 3 | ambient (4) | ของเดิม |
| `boss:*`, `cutscene:*` | เดิมทั้งหมด | Music/SFX ตามเดิม | 1 | — | ของเดิม |
| ดนตรี | `menuMusic`, drone ด่าน, `bossMusic` | Music | 4 | — | — |

## 4. Audio Environment Zones

ใช้ region เดิมของแมพ (เป็นกล่องอยู่แล้ว) + ตาราง tag ใน config (override ต่อ region ได้) — ไม่ต้องวาดกล่องใหม่ทั้งหมด

| Zone | IR (RT60 / pre-delay / damping / wet) | region เดิม |
|---|---|---|
| Indoor Corridor | 1.0 s / 12 ms / กลาง / 0.36 | `C\d*` ในโรงเรียน, ทางเดินโรงพยาบาล |
| Underground Corridor | 1.4 s / 18 ms / มืด / 0.42 | ทางเดินบังเกอร์ |
| Small Enclosed Room | 0.5 s / 6 ms / สว่าง / 0.28 | ห้องเรียน, ห้องน้ำ, ห้องเล็ก (ค่าเริ่มต้นของ region ที่ไม่เข้าแบบอื่น) |
| Large Interior Room | 2.2 s / 25 ms / มืด / 0.44 | `ENTRY`, `BOSS`, `GAL`, `LANDING`, `STAIR`, ห้องสมุด, หอประชุม |
| Large Warehouse | 2.8 s / 35 ms / มืด / 0.46 | โกดังบังเกอร์ (ถ้ามี region) |
| Outdoor | 0.7 s / 60 ms (slap) / มืด / 0.13 | `YARD*`, ป่า, หน้าโรงเรียน |

- IR สร้าง procedural ตอนโหลด (ต่อยอด `makeIR` เดิม) cache ต่อ zone (6 buffer)
- **Convolver A/B 2 ตัว**: zone ใหม่ → ใส่ buffer ให้ตัวที่เงียบอยู่ → crossfade 0.6 s (config 0.5–1.0)
- Very Low: ไม่มี convolver · Low: delay + feedback lowpass · Medium: IR ยาวไม่เกิน 1.2 s · High: เต็ม · Ultra: เต็ม + distant reflection

## 5. Spatial + Occlusion
- HRTF: High ≤ 4 เสียงใกล้, Ultra ≤ 8 (ที่เหลือ equalpower) — สลับ `panningModel` ตอนจองเสียงเท่านั้น
- Occlusion: ray จากผู้ฟังถึงแหล่งเสียงกับ collider ผนังแบบง่าย (`world.colliders` เดิม, ประตูเลื่อนนับเมื่อปิด) — Medium 4 Hz/4 แหล่ง, High 8 Hz/8, Ultra 10 Hz/12; บัง → lowpass 900 Hz + −6 dB interpolate 0.2 s
- ห้ามแพนสุ่มที่ไม่มีตำแหน่งจริง (ambient one-shot ของเดิมที่ไม่มี pos จะได้ตำแหน่งสุ่มรอบผู้เล่นในโลกแทน)

## 6. Sound bank + Captions
- `public/js/data/soundbank.js` (`G.SOUNDBANK`, เป็น JS แทน JSON เพื่อโหลดแบบ script เดิม) event → recipe (procedural) หรือ `{files:[...mp3]}` ภายหลัง + `public/audio/CREDITS.md` เมื่อมีไฟล์จริง
- Captions: event ที่มี `caption` key → `G.T("cap.<key>")` 4 ภาษา + ลูกศรทิศจากมุมแหล่งเสียงเทียบกล้อง, ค่าตั้ง Subtitles/Captions (ปิดเป็นค่าเริ่มต้น)
- Sound Lab (`?lab=sound`): ทุก event / ทุกปืน / ทุก zone + peak meter (AnalyserNode บน Master)
- สคริปต์วัด peak/RMS ทุกกระบอก (OfflineAudioContext) รันใน Sound Lab และรายงานในสรุปรอบ 3
