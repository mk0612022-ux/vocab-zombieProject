# Vocab Zombie: IELTS Survival

เกม FPS ยิงซอมบี้เพื่อฝึกคำศัพท์ IELTS — ยิงซอมบี้ที่ถือคำศัพท์ตรงกับความหมายภาษาไทยที่โจทย์ให้

เล่นได้ทั้งคอมพิวเตอร์ (เมาส์+คีย์บอร์ด) และมือถือ/แท็บเล็ต (ระบบสัมผัส) ผ่านเบราว์เซอร์
ไม่ต้องติดตั้งอะไรเพิ่ม ไม่มีขั้นตอน build — เป็น HTML/CSS/JS ล้วน

## เล่นบนเครื่องตัวเอง

เปิดเซิร์ฟเวอร์ในเครื่อง แล้วเปิดลิงก์ที่ขึ้นมา:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve-lan.ps1
```

- เครื่องตัวเอง: `http://localhost:8080/`
- มือถือ/iPad ใน Wi-Fi วงเดียวกัน: ใช้ที่อยู่ `http://<IP ของเครื่อง>:8080/` ที่สคริปต์พิมพ์ออกมา

ถ้าอุปกรณ์อื่นเข้าไม่ได้ ให้เปิดพอร์ตใน Windows Firewall หนึ่งครั้ง (รัน PowerShell **แบบ Run as administrator**):

```powershell
New-NetFirewallRule -DisplayName "Vocab Zombie 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
```

## นำขึ้นเว็บ (GitHub Pages)

ทุก path ในเกมเป็น relative path ทั้งหมด จึงวางไว้ที่ root หรือในโฟลเดอร์ย่อยก็ทำงานได้เหมือนกัน
(ทดสอบแล้วทั้งสองแบบ) ไฟล์ `.nojekyll` มีไว้กัน GitHub ข้ามไฟล์ที่ขึ้นต้นด้วย `_`

ครั้งแรก:

```bash
git init
git add .
git commit -m "Vocab Zombie"
git branch -M main
git remote add origin https://github.com/<ชื่อผู้ใช้>/<ชื่อ repo>.git
git push -u origin main
```

จากนั้นใน GitHub: **Settings → Pages → Source = Deploy from a branch → Branch = main / (root) → Save**
รอสัก 1-2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/`

## อัปเดตเกมเวอร์ชันใหม่

แก้ไฟล์ในเครื่อง แล้วสั่งสามบรรทัดนี้ เว็บจะอัปเดตเองใน 1-2 นาที:

```bash
git add .
git commit -m "อธิบายสิ่งที่แก้"
git push
```

## การควบคุม

| | คอมพิวเตอร์ | มือถือ / แท็บเล็ต |
|---|---|---|
| เดิน | WASD | จอยสติ๊กซ้ายล่าง |
| หมุนกล้อง | เมาส์ | ลากนิ้วครึ่งขวาของจอ |
| ยิง | คลิกซ้าย | ปุ่ม FIRE |
| เล็ง (ซูม) | คลิกขวาค้าง | ปุ่ม "เล็ง" (กดสลับ) |
| วิ่ง | Shift | ปุ่ม "วิ่ง" |
| ใช้งาน/เก็บของ | E | ปุ่ม E |
| รีโหลด | R | ปุ่ม R |
| กระโดด | Space | ปุ่ม JUMP |
| สลับอาวุธ | 1-5 | แถวปุ่มตัวเลขกลางล่างจอ |
| หยุดเกม | ESC | — |

เกมจะสลับชุดควบคุมให้เองตามอุปกรณ์ที่ใช้ และตั้งกราฟิกเป็น "ปานกลาง" อัตโนมัติบนมือถือ/แท็บเล็ต
(เปลี่ยนได้ที่ Settings)

## โครงสร้างไฟล์

```
index.html         หน้าเกมและ HUD ทั้งหมด
css/style.css      สไตล์ เมนู HUD และ layout สำหรับจอมือถือ
js/core.js         การบันทึกเกม อินพุต (คีย์บอร์ด/เมาส์/สัมผัส/เกมแพด)
js/entities.js     ซอมบี้ อาวุธ และเอฟเฟกต์อนุภาค
js/world.js        การสร้างฉากแต่ละด่าน
js/systems.js      ระบบ spawn บอส ร้านค้า achievement
js/ui.js           เมนู หน้าจอ และ HUD
js/game.js         ลูปเกมหลักและกฎการเล่น
js/data/words.js   คลังคำศัพท์
serve-lan.ps1      เซิร์ฟเวอร์ทดสอบในเครื่อง (เปิดให้อุปกรณ์อื่นในวง Wi-Fi เข้าได้)
serve.ps1          เซิร์ฟเวอร์ทดสอบเฉพาะเครื่องตัวเอง (มี endpoint จับภาพหน้าจอ)
```
