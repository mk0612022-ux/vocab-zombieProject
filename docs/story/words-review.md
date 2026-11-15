# ร่างคำศัพท์ใหม่ของบทที่ 1 — รอผู้ใช้ตรวจ (ยังไม่ได้รวมเข้าคลังคำ)

ตามที่ตัดสินใน D1 (`plan.md` ข้อ 3): คำหลัก 16 คำและคำทอง 3 คำที่ Master Word Bank ยังไม่มี (`audit.md` ข้อ 3) Claude ร่างครบทุกฟิลด์ 4 ภาษา **ผู้ใช้ตรวจก่อน แล้วค่อยรวมเข้า `word-bank.csv`** ระหว่างนี้บทที่ 1 ใช้แค่ 14 คำที่คลังมีอยู่แล้ว (`js/data/story/ch1.js` ข้ามคำที่ยังไม่มีเอง)

## ไฟล์

| ไฟล์ | เนื้อหา |
|---|---|
| `words-draft.csv` | 19 แถว คอลัมน์ 30 ช่องเหมือน `word-bank.csv` ทุกอย่าง (คัดลอกแถวไปต่อท้ายได้เลย) |
| `words-draft-confusables.csv` | 13 แถว คำลวงจากตารางของเอกสารที่ไม่มีทั้งในคลังและใน `word-bank-confusables.csv` (คอลัมน์เดียวกับไฟล์นั้น) |

เปิดใน Excel หรือ Google Sheets ได้ (UTF-8 มี BOM) · คอลัมน์ `review` ของทุกแถวเป็น `th | zh | fr` แปลว่ายังไม่มีคนตรวจ ตรวจภาษาไหนแล้วลบภาษานั้นออก (ตัวตรวจคำของเกมจะนับว่า "needs review" จนกว่าจะลบ)

## ผลการตรวจด้วยเครื่องมือของโปรเจกต์

นำสองไฟล์ไปต่อท้ายคลังในสำเนาชั่วคราว แล้วรัน `tools/words-import.ps1` (สร้าง `bank_*.js` ใหม่ + `validate-words.ps1`) โดยไม่แตะไฟล์จริง:

- ผ่านทุกกฎ: ฟิลด์ครบ · ชนิดคำ · นิยามไม่มีรูปคำของตัวเอง · ตัวอย่างและ collocation ทุกอันมีรูปคำ · ไทย/จีน/ฝรั่งเศสไม่ซ้ำกับคำอื่นในด่านเดียวกัน · พินอินมีวรรณยุกต์และพยางค์เท่าจำนวนตัวอักษร · เพศคำนามฝรั่งเศส · ตระกูลคำไม่ชนกับคำที่มีอยู่ · คำลวงทุกคำหาเจอ · stress สะกดตรงกับคำ
- จำนวนคำต่อด่านหลังรวม: ด่าน 1 = 291 (จาก 283), ด่าน 2 = 303 (จาก 298), ด่าน 3 = 311 (จาก 305) · ทั้งคลัง 905 คำ (จาก 886) · เกณฑ์ของตัวตรวจ 240–330 ต่อด่าน
- ที่ยังไม่มี (ไม่ใช่ข้อผิดพลาด): คำอธิบายคำตอบ (`explain_th/zh/fr.js`: คำแปลประโยคตัวอย่าง โน้ตคู่คำลวง โน้ตคำสะกดผิด) ของคำใหม่ หลังรวมแล้วการ์ดอธิบายจะแสดงประโยคภาษาอังกฤษไปก่อน

## เรื่องที่ผู้ใช้ต้องตัดสิน

1. **ด่านที่คำเข้าไปอยู่**: คอลัมน์ `level` ตัดสินว่าคำอยู่ไฟล์คลังของด่านแคมเปญไหน (1 โรงเรียน · 2 โรงพยาบาล · 3 บังเกอร์) ร่างนี้แบ่งตามระดับ CEFR ในเอกสาร (B1 → 1, B2 → 2, C1 ขึ้นไป → 3) คือด่าน 1 เพิ่ม 8 คำ ด่าน 2 เพิ่ม 5 คำ ด่าน 3 เพิ่ม 6 คำ **แปลว่าแคมเปญจะเจอคำเหล่านี้ด้วย**
   - (ก) รวมตามนี้ (ข้อเสนอ: คำระดับ IELTS ทั้งหมด แคมเปญได้คำเพิ่ม ไม่ต้องแก้โค้ด)
   - (ข) เก็บเป็นคลังเฉพาะ Story Mode แคมเปญไม่เปลี่ยน (ต้องเพิ่มไฟล์คลังที่ 4 และแก้ตัว import/ตัวตรวจ/ตัวโหลด)
2. **side effect** เป็นคำแรกในคลังที่มีช่องว่าง (id `side-effect` เพราะ id ใช้ได้แค่ a-z 0-9 และขีด) โหมดสะกดต้องพิมพ์ช่องว่างหรือขีด (`acceptedSpellings` รับทั้ง `side effect` และ `side-effect`) จะทดสอบตอนรวมเข้าคลัง
3. คำลวงในเอกสารที่ไม่ได้ใส่: `proficient` (เป็นรูปคำของ proficiency เอง ใส่เป็นคำลวงของตัวเองไม่ได้ อยู่ในช่อง family แทน) · `scared` (เป็นรูปของ scare ซึ่งใส่ไว้แล้ว)

## คำหลักและคำทอง (19 คำ)

ตรวจคอลัมน์ "ไทย" เป็นหลัก ส่วนจีนและฝรั่งเศสเป็นร่างของ Claude เช่นกัน

| # | คำ | ชนิด | ด่าน | ไทย | นิยาม (อังกฤษ) | จีน | ฝรั่งเศส | คำลวง |
|---|---|---|---|---|---|---|---|---|
| 1 | candidate | n | 1 | ผู้เข้าสอบ/ผู้สมัคร | a person who is taking an exam, or who is applying for a job or position | 考生 kǎoshēng | candidat (m) | candle, candid |
| 2 | proficiency | n | 3 | ความชำนาญ/ความสามารถทางภาษา | a high level of skill or ability, especially in a language | 熟练程度 shúliàn chéngdù | maîtrise (f) | efficiency |
| 3 | invigilator | n | 3 | ผู้คุมสอบ | a person who watches students during an exam to make sure that nobody cheats | 监考员 jiānkǎoyuán | surveillant (m) | investigator, instructor |
| 4 | sponsor | n/v | 2 | ผู้สนับสนุน/ให้การสนับสนุน | a person or company that pays for an event or activity, often to advertise itself | 赞助商 zànzhùshāng | commanditaire (m/f) | spokesperson |
| 5 | emergency | n | 1 | เหตุฉุกเฉิน | a sudden, dangerous situation that needs action at once | 紧急情况 jǐnjí qíngkuàng | urgence (f) | emergence |
| 6 | opposite | adj/prep | 1 | ตรงข้าม | across from something, on the other side of a road, room or space; also completely different | 对面 duìmiàn | en face de | opponent |
| 7 | barricade | n/v | 3 | สิ่งกีดขวาง/ปิดกั้น | a line of objects put across a road or doorway to stop people from getting past | 路障 lùzhàng | barricade (f) | barrack |
| 8 | infection | n | 2 | การติดเชื้อ | an illness caused by bacteria or a virus getting into the body | 感染 gǎnrǎn | infection (f) | injection, inflection |
| 9 | supply | n/v | 1 | เสบียง/จัดหาให้ | an amount of food, water or other things that people need, kept ready to use | 补给 bǔjǐ | ravitaillement (m) | supplement, apply |
| 10 | scarce | adj | 3 | ขาดแคลน/หายาก | not easy to find or get because there is not enough of it | 稀缺 xīquē | rare | scare |
| 11 | announcement | n | 1 | ประกาศ | a public statement that gives people information about something | 公告 gōnggào | annonce (f) | amusement |
| 12 | evacuate | v | 3 | อพยพ | to move people out of a dangerous place to somewhere safe | 撤离 chèlí | évacuer | evaluate |
| 13 | avoid | v | 1 | หลีกเลี่ยง | to stay away from someone or something, or to stop something bad from happening | 避免 bìmiǎn | éviter | afford |
| 14 | trial | n | 2 | การทดลอง/การพิจารณาคดี | a test of a new medicine, method or product to see if it works and is safe; also the process of judging a case in court | 试验 shìyàn | essai (m) | trail |
| 15 | side effect | n | 2 | ผลข้างเคียง | an extra and usually unwanted result of a medicine or treatment | 副作用 fùzuòyòng | effet secondaire (m) | (สะกดผิดที่พบบ่อย: side affect) |
| 16 | protect | v | 1 | ปกป้อง | to keep someone or something safe from harm or danger | 保护 bǎohù | protéger | project, predict |
| 17 | shortcut ★ | n | 1 | ทางลัด | a quicker way of getting somewhere or of doing something | 捷径 jiéjìng | raccourci (m) | — |
| 18 | fluent ★ | adj | 2 | คล่องแคล่ว/พูดได้คล่อง | able to speak or write a language easily and well | 流利 liúlì | fluide | — |
| 19 | perseverance ★ | n | 3 | ความพากเพียร | the quality of continuing to try even when something is difficult | 毅力 yìlì | persévérance (f) | — |

★ = คำทอง (ของสะสม รอบ 11) · คำทองอีกคำ `integrity` มีในคลังแล้ว

ข้อสังเกตที่ควรดู:
- candidate: จีนเลือก 考生 (ผู้เข้าสอบ) ตามบริบทห้องสอบของบทนี้ ความหมาย "ผู้สมัครงาน/ผู้สมัครเลือกตั้ง" (候选人) จึงไม่อยู่ในช่องจีน
- opposite: เอกสารใช้แบบบอกตำแหน่ง ("The library is opposite the music room") จีนและฝรั่งเศสจึงแปลตามความหมายนั้น (对面, en face de)
- trial: ใส่สองความหมาย (การทดลองยา/การพิจารณาคดี) เพราะ IELTS เจอทั้งสองแบบ บทนี้ใช้แบบแรก
- sponsor, barricade, supply เป็น n/v ตามเอกสาร: ไทยมีสองความหมาย (นาม/กริยา) นิยามและจีน/ฝรั่งเศสใช้ความหมายนามแบบเดียวกับคำ n/v ที่มีในคลัง (approach, focus)

ประโยคตัวอย่าง collocation ตระกูลคำ การออกเสียง และคำสะกดผิดที่พบบ่อย อยู่ใน `words-draft.csv`

## คำลวงที่ต้องเพิ่มใน `word-bank-confusables.csv` (13 คำ)

| คำ | ชนิด | ไทย | นิยาม | เป็นคำลวงของ |
|---|---|---|---|---|
| afford | v | มีเงินพอ/มีเวลาพอ | to have enough money or time to pay for or do something | avoid |
| amusement | n | ความขบขัน/ความบันเทิง | the feeling you have when something is funny or entertaining | announcement |
| apply | v | สมัคร/นำไปใช้ | to ask formally for a job or a place; also to use something in a particular situation | supply |
| barrack | n | ค่ายทหาร | a building where soldiers live, usually called barracks | barricade |
| candid | adj | ตรงไปตรงมา | honest and direct, even when the truth is not pleasant | candidate |
| candle | n | เทียน | a stick of wax with a string inside that you burn to give light | candidate |
| efficiency | n | ประสิทธิภาพ | doing something well without wasting time, money or energy | proficiency |
| inflection | n | การผันรูปคำ/เสียงขึ้นลง | a change in the form of a word to show its grammar; also the rise and fall of the voice | infection |
| injection | n | การฉีดยา | putting a drug into the body through a needle | infection |
| opponent | n | คู่ต่อสู้/ฝ่ายตรงข้าม | a person or team you are competing or fighting against | opposite |
| scare | v | ทำให้กลัว | to make someone feel afraid | scarce |
| spokesperson | n | โฆษก | a person chosen to speak officially for a group or organisation | sponsor |
| trail | n | ทางเดินในป่า/ร่องรอย | a path through the countryside, or a line of marks left by someone or something passing | trial |

คำลวงอื่นในเอกสาร (emergence, investigator, instructor, supplement, evaluate, project, predict) มีในคลังอยู่แล้ว

## ขั้นตอนหลังผู้ใช้ตรวจ

1. แก้ใน `words-draft.csv` / `words-draft-confusables.csv` โดยตรง หรือบอก Claude ว่าแก้คำไหนเป็นอะไร
2. Claude นำแถวไปต่อท้าย `word-bank.csv` และ `word-bank-confusables.csv` แล้วรัน `tools/words-import.ps1` (สร้างไฟล์คลังของเกมใหม่และตรวจทั้งคลัง)
3. บทที่ 1 ใช้ครบ 30 คำเองโดยไม่ต้องแก้ `ch1.js` · ทดสอบโหมดสะกดของ side effect · เพิ่มคำอธิบายคำตอบของคำใหม่ (คำแปลตัวอย่าง โน้ตคู่คำลวง)
