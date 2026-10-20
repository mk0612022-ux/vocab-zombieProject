# VFX Event Map (ออกแบบรอบ 0 · ลงมือรอบ 2 และ 4)

## 1. ของเดิม (สำรวจจากโค้ด ณ `2dfc582`)

| เอฟเฟกต์ | ที่อยู่ | สภาพ |
|---|---|---|
| Muzzle flash | `entities.js` `G.spawnMuzzleFlash` → `G.Perf.flash()` (ไฟดวงเดียว `flashLight` 50 ms) | ไม่มี sprite, ปิดที่ Very Low, ไม่ลดตาม RPM |
| ปลอกกระสุน | `G.spawnShellEject` | **สร้าง Mesh + Geometry ใหม่ทุกนัด** + `requestAnimationFrame` ของตัวเอง (เดินต่อแม้ pause) ปิดที่ Very Low/Low |
| ประกายกระทบ | `G.Perf.sparks()` pool `Points` สูงสุด 24 ชุด × ≥18 จุด (สีตามเป้า) + `G.spawnHitParticles` (fallback สร้างใหม่) | ไม่มี surfaceType, ไม่มี decal |
| ซอมบี้ตาย/เกิด/เลือด | `zombiefx.js` `InstancedMesh` 260 ก้อน (pool round-robin) | **คง** + Blood & Gore |
| ระเบิด | `game.js` `splashDamage` + `G.Audio.explosion` | ภาพระเบิดใช้ไฟ flash + blocks |
| กระจก | `glass.js` `G.Glass` แตกได้ ไม่หยุดกระสุน | **คง** ส่ง `hit:impact {surface:"glass"}` เพิ่ม |
| Hit marker | `ui.js` `showHitmarker(head)` มีแบบ headshot แล้ว | **คง** |
| Light pool | `perf.js` `LIGHT_POOL` vhigh 10 / high 8 / medium 6 / low 4 / vlow 3 + flashLight แยก | **คง** ไม่เพิ่ม/ลบ light ระหว่างเล่น |

ชื่อ tier ในเกม → ในสเปก: `vlow` = Very Low · `low` = Low · `medium` = Medium (iPad) · `high` = High · `vhigh` = Ultra

## 2. ระบบใหม่ `G.FX` (`public/js/fx.js`)

- pool กลางตั้งแต่โหลดด่าน (ไม่สร้าง object ระหว่างยิง): particle แบบ `InstancedMesh` ลูกบาศก์เล็ก (เข้ากับสไตล์ voxel), sprite pool สำหรับ flash/smoke, decal pool
- เดินด้วย `G.Clock` (หยุดเมื่อ pause/modal) — ย้าย shell eject และ hit particle fallback ออกจาก rAF ของตัวเอง
- **งบต่อ tier** (สเปกรอบ 8): นับ particle ที่มีชีวิตรวมทุกชนิด เกินงบ → emitter ใหม่ได้จำนวนน้อยลง (ลดตามสัดส่วน) ไม่แย่งของที่กำลังเล่น
- ไม่ spawn นอก frustum หรือไกลกว่า fog far (ยกเว้น flash ของปืนผู้เล่น)
- ลด alpha ของ smoke/particle ที่อยู่ใกล้กลางจอ (รัศมี 12% ของจอ) ไม่บังศัตรู ป้ายคำ หรือ UI
- ป้ายคำยังวาดทับทุกอย่างตามกฎระบบแสงเดิม (ไม่โดน bloom/หมอก)

## 3. ตาราง Tier

| | Very Low | Low | Medium | High | Ultra |
|---|---|---|---|---|---|
| Particle สูงสุด (รวม) | 60 | 120 | 250 | 500 | 900 |
| Decal สูงสุด | 0 | 24 | 48 | 96 | 160 |
| แสงจาก muzzle flash | ✗ (sprite จาง) | ทุก 2 นัด | ✓ | ✓ | ✓ |
| Smoke | ✗ | 1 puff/นัด สั้น | ✓ | ✓ | ✓ + ควันลอยจากปากกระบอกหลังยิงรัว |
| Shell eject | ✗ | ✗ (เดิม) | ✓ | ✓ | ✓ |
| Decal อายุ (วินาที) | — | 8 | 12 | 18 | 25 |

## 4. Event → Effect

| Event | เอฟเฟกต์ | Pool / ข้อจำกัด |
|---|---|---|
| `weapon:fire` | **flash sprite** 40–60 ms รูปทรงตามตระกูล (pistol เล็ก, rifle ยาว, shotgun กว้าง, energy/beam สีตามปืน) 4 แบบสุ่มหมุน วาดใน viewmodel pass (layer 1) | sprite pool 4 ต่อผู้เล่น · 1 ชุดต่อ `shotId` |
| | **flash light** จาก `G.Perf.flash` เดิม — intensity × ค่า Muzzle Flash (0–100%) × (RPM > 600 ? 0.5 : 1) | 1 ดวง (เดิม) · ห้ามเพิ่ม light |
| | **smoke puff** | sprite pool 24 · ปิด Very Low |
| | **shell eject** (ปืนที่มีปลอก; ลูกซองดีดตอน pump, energy ไม่มี) | InstancedMesh 32 · ปิด Very Low/Low |
| `weapon:reload marker` | ปลอกลูกซองตก (ตอน `pump` ของ empty), แม็กเก่าหล่น (`magDrop` เฉพาะ empty, Medium+) | ใช้ pool shell/particle |
| `hit:impact` concrete | ฝุ่นเทา + เศษปูน 4–6 ก้อน + decal รู | particle + decal |
| tile | เศษกระเบื้องขาว 3–5 + decal ร้าว | particle + decal |
| wood | เสี้ยนไม้ยาว 3–5 + decal รู | particle + decal |
| metal | ประกายไฟ 5–8 (ใช้ `G.Perf.sparks` เดิมได้) + decal รอยบุบ | sparks + decal |
| glass | เศษกระจก 4–6 (ของเดิม `G.Glass` แตกได้) | particle |
| grass | ใบหญ้า 3–4 ไม่มี decal | particle |
| dirt / mud | ดินกระเด็น 4–6 | particle |
| water | น้ำกระเซ็น 4–6 (แอ่งน้ำ Very High เดิม) | particle |
| flesh (ซอมบี้) | เลือด (Full) / น้อย (Reduced) / ฝุ่นเทา (Off) — Runt ใช้ Reduced เสมอ | `ZombieFX` pool เดิม |
| `zombie:die` | ควัน + ก้อนบล็อก (เดิม) / headshot หัวหลุด (เดิม, ตาม Blood & Gore) | `ZombieFX` 260 |
| `zombie:special` Bloater | บวม 0.8–1.2 s (scale + emissive pulse ช้า ≤ 2 ครั้ง/วินาที) → ระเบิด (blocks + ควัน, ไม่มีแสงวาบเต็มจอ) | `ZombieFX` + flash light (ระยะสั้น) |
| `zombie:special` Ironclad | หมวกกระเด็น (ชิ้นจริงจาก pool) + ประกายไฟ | sparks |
| explosion (launcher/cannon) | blocks + ควัน + flash light (เดิม) | ไม่เกินงบ particle |
| `player:hurt` | vignette แดง (UI) ตามค่า Screen Effects | ไม่ใช่ particle |

## 5. Decal
- Quad บาง ๆ วางที่ `point + normal × 0.002`, หันตาม normal, `polygonOffset` กัน z-fighting
- `InstancedMesh` ต่อกลุ่มลาย (รู/ร้าว/บุบ) กลุ่มละ 1 draw call — texture 16 px atlas `NearestFilter`
- r128 ไม่มี alpha ต่อ instance โดยตรง → จางหายด้วยการหดขนาดลง 0.4 s ท้ายอายุ (สมมติฐาน: ถ้าดูไม่ดี เพิ่ม attribute alpha ผ่าน `onBeforeCompile`)
- ไม่ติด decal บนซอมบี้, ประตูเลื่อน (เคลื่อนที่) และกระจก

## 6. surfaceType กลาง (ใช้ร่วม impact + เสียงกระทบ + ฝีเท้า)
- ค่า: `concrete, tile, wood, metal, glass, grass, dirt, water, flesh`
- ที่มา: `mesh.userData.surface` ที่ตั้งตอนสร้างแมพ (world.js / campus.js / schoolrooms.js / forest.js) → fallback จาก material/theme (โรงเรียน = tile ในอาคาร, grass ใน `YARD*`, wood ในห้องสมุด · โรงพยาบาล = tile · บังเกอร์ = concrete/metal)
- ฝีเท้าเดิมที่ใช้ `theme + YARD` จะเปลี่ยนมาอ่าน surface ใต้เท้า (raycast ลง 1 ครั้งต่อก้าว)

## 7. ตรวจผ่านรอบ 2
- debug overlay แสดง particle ที่มีชีวิต / งบ, decal / งบ, sprite ที่ใช้, draw calls
- Weapon Lab ถ่ายภาพทุกตระกูล + ยิงใส่ผนังทุก surface
