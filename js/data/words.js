// ============================================================
// Vocabulary data — IELTS / Academic Word List style, EN -> TH
// Kept separate from game logic so words can be edited/extended easily.
// Each level has its own word set. Combined total >= 100 words.
// ============================================================
window.G = window.G || {};

G.WORDS_LEVEL_1 = [
  ["abandon", "ละทิ้ง"], ["ability", "ความสามารถ"], ["accurate", "แม่นยำ"],
  ["achieve", "บรรลุผล"], ["adapt", "ปรับตัว"], ["adequate", "เพียงพอ"],
  ["approach", "แนวทาง/เข้าใกล้"], ["assist", "ช่วยเหลือ"], ["assume", "สันนิษฐาน"],
  ["available", "มีอยู่/ใช้ได้"], ["benefit", "ผลประโยชน์"], ["capacity", "ความจุ/ศักยภาพ"],
  ["challenge", "ความท้าทาย"], ["circumstance", "สถานการณ์"], ["community", "ชุมชน"],
  ["concept", "แนวคิด"], ["conclude", "สรุป"], ["consist", "ประกอบด้วย"],
  ["contribute", "มีส่วนร่วม"], ["create", "สร้างสรรค์"], ["define", "ให้คำจำกัดความ"],
  ["demonstrate", "แสดงให้เห็น"], ["diverse", "หลากหลาย"], ["environment", "สิ่งแวดล้อม"],
  ["establish", "ก่อตั้ง"], ["evidence", "หลักฐาน"], ["factor", "ปัจจัย"],
  ["feature", "ลักษณะเด่น"], ["focus", "จุดสนใจ/มุ่งเน้น"], ["identify", "ระบุ"],
  ["impact", "ผลกระทบ"], ["indicate", "บ่งชี้"], ["individual", "บุคคล/ปัจเจก"],
  ["involve", "เกี่ยวข้อง"], ["issue", "ประเด็น"], ["maintain", "รักษาไว้"],
  ["obtain", "ได้รับ"], ["occur", "เกิดขึ้น"], ["previous", "ก่อนหน้า"],
  ["require", "ต้องการ/จำเป็น"]
];

G.WORDS_LEVEL_2 = [
  ["significant", "มีนัยสำคัญ"], ["strategy", "กลยุทธ์"], ["structure", "โครงสร้าง"],
  ["sufficient", "เพียงพอ"], ["technique", "เทคนิค"], ["tendency", "แนวโน้ม"],
  ["transform", "เปลี่ยนแปลง/แปรสภาพ"], ["variable", "ตัวแปร"], ["analyse", "วิเคราะห์"],
  ["assess", "ประเมิน"], ["consequent", "ที่ตามมา"], ["constant", "คงที่"],
  ["constrain", "จำกัด/บีบบังคับ"], ["distribute", "กระจาย"], ["emphasis", "การเน้นย้ำ"],
  ["ensure", "ทำให้แน่ใจ"], ["exclude", "ยกเว้น/กีดกัน"], ["framework", "กรอบแนวคิด"],
  ["fundamental", "พื้นฐาน/สำคัญมาก"], ["generate", "สร้าง/ก่อให้เกิด"], ["implement", "นำไปปฏิบัติ"],
  ["implicit", "โดยนัย"], ["incidence", "อุบัติการณ์/ความถี่"], ["inevitable", "หลีกเลี่ยงไม่ได้"],
  ["initial", "เริ่มต้น"], ["integrate", "ผสมผสาน"], ["interpret", "ตีความ"],
  ["justify", "ให้เหตุผลสนับสนุน"], ["mechanism", "กลไก"], ["method", "วิธีการ"],
  ["minor", "เล็กน้อย"], ["negate", "ปฏิเสธ/หักล้าง"], ["outcome", "ผลลัพธ์"],
  ["perceive", "รับรู้"], ["persist", "ยืนกราน/ดำเนินต่อไป"], ["potential", "ศักยภาพ"],
  ["predict", "ทำนาย"], ["principle", "หลักการ"], ["proportion", "สัดส่วน"],
  ["stable", "มั่นคง"], ["sustain", "ค้ำจุน/ดำรงไว้"]
];

G.WORDS_LEVEL_3 = [
  ["abstract", "เชิงนามธรรม"], ["accompany", "ไปด้วยกัน/ประกอบกับ"], ["accumulate", "สะสม"],
  ["accurate", "ถูกต้องแม่นยำ"], ["acknowledge", "ยอมรับ"], ["adjacent", "อยู่ติดกัน"],
  ["ambiguous", "กำกวม"], ["anticipate", "คาดการณ์ล่วงหน้า"], ["arbitrary", "ตามอำเภอใจ"],
  ["attain", "บรรลุ/ไปถึง"], ["comprehensive", "ครอบคลุม"], ["conceive", "คิดขึ้น/ตั้งครรภ์"],
  ["contradict", "ขัดแย้ง"], ["controversy", "ข้อโต้แย้ง"], ["convention", "ธรรมเนียมปฏิบัติ"],
  ["coincide", "เกิดขึ้นพร้อมกัน"], ["derive", "ได้มาจาก"], ["devote", "อุทิศตน"],
  ["discrete", "แยกจากกันชัดเจน"], ["discriminate", "แบ่งแยก/เลือกปฏิบัติ"], ["displace", "แทนที่"],
  ["dominant", "ที่มีอิทธิพลเหนือ"], ["duration", "ระยะเวลา"], ["dynamic", "มีพลวัต"],
  ["empirical", "เชิงประจักษ์"], ["equivalent", "เทียบเท่า"], ["exceed", "เกินกว่า"],
  ["exploit", "ใช้ประโยชน์/แสวงประโยชน์"], ["facilitate", "อำนวยความสะดวก"], ["hierarchy", "ลำดับชั้น"],
  ["hypothesis", "สมมติฐาน"], ["inherent", "โดยธรรมชาติ/แต่กำเนิด"], ["intermediate", "ระดับกลาง"],
  ["intrinsic", "โดยเนื้อแท้"], ["notion", "ความคิดเห็น/แนวคิด"], ["paradigm", "กระบวนทัศน์"],
  ["parallel", "ขนาน/คล้ายคลึง"], ["phenomenon", "ปรากฏการณ์"], ["subsequent", "ที่ตามมาภายหลัง"],
  ["ultimately", "ในที่สุด"], ["vulnerable", "เปราะบาง/เสี่ยงภัย"]
];

// Registry of built-in word sets (extended at runtime by Import Vocabulary)
G.WORD_SETS = {
  level1: { name: "ชุดคำศัพท์ด่าน 1", words: G.WORDS_LEVEL_1, builtin: true },
  level2: { name: "ชุดคำศัพท์ด่าน 2", words: G.WORDS_LEVEL_2, builtin: true },
  level3: { name: "ชุดคำศัพท์ด่าน 3", words: G.WORDS_LEVEL_3, builtin: true },
};

G.getAllBuiltinWords = function () {
  return [].concat(G.WORDS_LEVEL_1, G.WORDS_LEVEL_2, G.WORDS_LEVEL_3);
};
