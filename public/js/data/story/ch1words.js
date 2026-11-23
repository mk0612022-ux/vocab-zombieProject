// ===================================================================
// Chapter 1's practice words (story series, round 5) -- vocabulary data
// -------------------------------------------------------------------
// The words the prologue uses that the Master Word Bank does not have:
// the design's practice words (CLEAN / CLEAR / LEAN on the corridor's
// zombies -- counted nowhere) and the practice exam's answers and wrong
// answers whose meaning the bank does not give, each with its meaning in the
// four meaning languages (js/story/aimquiz.js glossOf picks the player's).
// Drafts, as the chapter's subtitles are (decision D8): the user checks the
// Thai. The words of docs/story/words-draft.csv that later join the bank
// (decision D1) are then the bank's, and their entry here is no longer read.
// (tools/thai-scan.ps1 skips this file: its Thai is vocabulary, as the bank's.)
// ===================================================================
window.G = window.G || {};
G.STORY_WORDS = G.STORY_WORDS || {};
G.STORY_WORDS.ch1 = {
  clean: { th: "ทำความสะอาด", zh: "打扫；清洁", fr: "nettoyer", en: "to make something free of dirt" },
  clear: { th: "ใส; ชัดเจน", zh: "清楚的；透明的", fr: "clair", en: "easy to see through or to understand" },
  lean: { th: "เอนตัว; พิง", zh: "倾斜；倚靠", fr: "se pencher", en: "to bend or rest against something" },
  invigilator: { th: "ผู้คุมสอบ", zh: "监考人", fr: "surveillant d'examen", en: "a person who watches candidates during an exam" },
  investigator: { th: "ผู้สืบสวน", zh: "调查员", fr: "enquêteur", en: "a person who finds out the facts about a crime" },
  instructor: { th: "ผู้สอน; ครูฝึก", zh: "教练；讲师", fr: "instructeur", en: "a person who teaches a skill" },
  candidate: { th: "ผู้เข้าสอบ; ผู้สมัคร", zh: "考生；候选人", fr: "candidat", en: "a person taking an exam or applying for a job" },
  candle: { th: "เทียนไข", zh: "蜡烛", fr: "bougie", en: "a stick of wax that gives light as it burns" },
  candid: { th: "ตรงไปตรงมา", zh: "坦率的", fr: "franc", en: "saying what you really think" },
  scholar: { th: "นักวิชาการ", zh: "学者", fr: "érudit", en: "a person who studies a subject deeply" },
  schedule: { th: "ตารางเวลา", zh: "日程表", fr: "emploi du temps", en: "a plan of when things will happen" },
  // (story round 7) scene 1-4: the nurse's medicine cabinet -- the three on Kru Min's list and the
  // three that are not (practice words: the design's), and Nurse Pim's last word
  bandage: { th: "ผ้าพันแผล", zh: "绷带", fr: "bandage", en: "a strip of cloth wrapped round a wound" },
  antiseptic: { th: "ยาฆ่าเชื้อทาแผล", zh: "消毒药水", fr: "antiseptique", en: "a liquid that kills germs in a cut" },
  gauze: { th: "ผ้าก๊อซ", zh: "纱布", fr: "compresse de gaze", en: "thin cloth laid on a wound under a bandage" },
  "cough syrup": { th: "ยาแก้ไอแบบน้ำ", zh: "止咳糖浆", fr: "sirop contre la toux", en: "a sweet liquid medicine for a cough" },
  "eye drops": { th: "ยาหยอดตา", zh: "眼药水", fr: "gouttes pour les yeux", en: "liquid put into the eyes in drops, for sore or dry eyes" },
  "ice pack": { th: "ถุงประคบเย็น", zh: "冰袋", fr: "poche de glace", en: "a cold pack held on a bump or a sprain" },
  rest: { th: "พัก; พักผ่อน", zh: "休息", fr: "se reposer", en: "to stop working or moving and relax" },
};
