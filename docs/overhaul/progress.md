# Progress — การปรับเปลี่ยนครั้งใหญ่

สเปกเต็ม: `docs/overhaul/PROMPT.md` · แผน: `implementation-plan.md`
กติกาการทำงาน (จากผู้ใช้): ทำทีละรอบแล้วหยุดให้ตรวจ · สรุปเป็นภาษาไทย · commit local เท่านั้น (ผู้ใช้ push เอง) · ห้ามแก้ commit ของผู้ใช้

| รอบ | หัวข้อ | สถานะ |
|---|---|---|
| 0 | สำรวจระบบเดิม + เอกสารออกแบบ | ✅ เสร็จ (2026-10-20, `3c2338f`) |
| 1 | Weapon State Machine + แอนิเมชัน | ✅ เสร็จ (2026-10-20) — รอผู้ใช้ตรวจ |
| 2 | รูปลักษณ์อาวุธ + VFX | ⏳ |
| 3 | ระบบเสียงทั้งเกม | ⏳ |
| 4 | ซอมบี้ 10 ชนิด | ⏳ |
| 5 | เมนูหลักใหม่ | ⏳ |
| 6 | HUD กลางล่าง | ⏳ |
| 7 | คำอธิบายคำตอบ | ⏳ |
| 8 | ทดสอบรวม + เตรียม deploy | ⏳ |

## รอบ 0
**ทำแล้ว**
- `PROMPT.md` (สำเนาสเปก), `architecture.md`, `weapon-state-machine.md`, `audio-event-map.md`, `vfx-event-map.md`, `implementation-plan.md`, `progress.md`
- ไม่ได้แก้โค้ดเกม

**ผู้ใช้ตัดสินใจแล้ว** ("ตามที่แนะนำ", 2026-10-20)
- HUD แสดงช่องตาม inventory จริง: มีด + ปืน 4 ช่อง แล้วเพิ่มเมื่อได้ perk `extra_slot`
- คำอธิบายรอบ 7: template ทุกคำ + เขียนเองเฉพาะคู่คำสับสน/สะกดผิด + แปลประโยคตัวอย่างทุกคำ
- ทำทีละรอบแล้วหยุดให้ตรวจเหมือนเดิม
- ไม่ติดตั้ง Node (ทดสอบในเบราว์เซอร์)

## รอบ 1 — Weapon State Machine + แอนิเมชัน
**ทำแล้ว**
- `js/bus.js` (`G.Bus`) event bus กลาง · `js/weaponsm.js` (`G.WeaponSM`) state machine 12 สถานะ ตรรกะล้วน (ไม่แตะ THREE/DOM) · `G.CONFIG.weaponSM` ใน `config.js`
- `game.js`: ยิง/รีโหลด/สลับ/เล็ง/วิ่ง/มีด ผ่าน state machine (`weaponHost()`), `shoot()` แยกเป็น gameplay ล้วน, ฟิลด์เดิม (`player.reloading`, `reloadState`, `weaponAnim.switchT`) อ่านจาก state machine, Lowered ตอนกด E / หน้าต่างคำถาม, Disabled ตอน cutscene / Game Over / ชนะ, flinch เมื่อโดนตี, Camera Recoil / Camera Shake
- รีโหลด tactical (ไม่มีจังหวะปล่อยสไลด์ เร็วขึ้น 15%) / empty / ลูกซองทีละนัด (pump เฉพาะตอนเริ่มจากหมด, กดยิง = หยุดหลังนัดในมือแล้วยิง), commit ครั้งเดียวต่อ reloadId + fallback ตาม timer
- `viewmodel.js`: inspect, lowered, ฟันมีด (hit frame 0.10 วิ), flinch, หายใจแรงขึ้นเมื่อ stamina ต่ำ, ปรับตำแหน่งปืนตามอัตราส่วนจอ, ซ่อนเมื่อ Disabled, เล็งตามน้ำหนักปืน (ease in/out)
- `gunaudio.js`: เสียงรีโหลด / สลับ (เก็บ-ชัก แยกกัน) / inspect เล่นจาก event ของ state machine (ไม่ตั้งเวลาล่วงหน้าข้ามการ pause)
- ตั้งค่าใหม่ (4 ภาษา): Auto Reload, Camera Recoil, Camera Shake, ปุ่ม Inspect (G) — save เก่าได้ค่าเริ่มต้นผ่าน `normalizeSave`
- `js/debug.js` (`?debug=1`) overlay + dev validator, `js/lab/weapons.js` (`?lab=weapons`) Weapon Lab — โหลดเฉพาะเมื่อขอ
- ทดสอบ: `tools/overhaul/wsm-test.js` (unit + fuzz 10,000 ครั้ง, `tools/overhaul/test.html`), `tools/round21-test.js` (ในเกม)

**ปัญหาที่พบ (มีมาก่อนรอบนี้ — ยกไปรอบ 2)**
- draw calls ที่ประตูโรงเรียนระดับ Low: โลกอย่างเดียว 135, + แขน 145, + ปืนในมือ 151–154 (เกินเป้า 150 ของชุดภาพ) — วัด commit ก่อนรอบนี้ (`3c2338f`) ได้เลขเดียวกันทุกตัว ชุดทดสอบ 3 เดิมผ่านเฉพาะตอนรันเดี่ยว (ไม่มีปืนในมือ) แต่ตกเมื่อรันต่อจากชุดอื่น → แก้ชุด 3 ให้นับเฉพาะโลก (ซ่อนปืนกับแขนตอนนับ) และจะลด draw call ของปืน/แขนในรอบ 2 (รวมชิ้นส่วนปืนที่ไม่ขยับ)

**เปลี่ยนพฤติกรรมจากเดิม (ตามสเปก, ปรับคืนได้ใน config)**
- วิ่งไม่ยกเลิกรีโหลดแล้ว (`sprintCancelsReload`) · กดยิงยกเลิกรีโหลดได้ทุกปืนถ้ายังมีกระสุนและยังไม่ถึง magIn (`fireCancelsReload`) · เล็งระหว่างรีโหลด/วิ่ง/สลับไม่ได้ · มีดโดนช้าลง 0.10 วิ (hit frame) · ปืนชาร์จที่ถูกขัด (สลับปืน) ไม่ยิงออกเอง

**ปัญหา / หมายเหตุ**
- เครื่องนี้ไม่มี Node/npx/Playwright/wrangler → ทดสอบด้วย `serve-lan.ps1` + headless Edge
- RAM 3.9 GB: เปิดแท็บเกมทีละ 1
- commit `2dfc582` (ชุดภาพรอบ 3 ต่อ) ยังไม่ได้ push

## ตัวเลขอ้างอิงก่อนเริ่ม (1280×720, 8 จุดในด่านโรงเรียน, ผลวัดล่าสุดของชุดภาพรอบ 3)
| tier | FPS เฉลี่ย | FPS ต่ำสุด (จุดที่แย่สุด) | draw calls เฉลี่ย |
|---|---|---|---|
| Very Low | 53 | 35 | 287 |
| Low | 48 | 34 | 344 |
| Medium | 35 | 25 | 418 |
| High | 28 | 21 | 479 |
| Very High | 19 | 14 | 485 |

(วัดบนเครื่องพัฒนาแบบ headless — ไม่ใช่ตัวแทน iPad/desktop จริง ใช้เทียบก่อน/หลังเท่านั้น)
