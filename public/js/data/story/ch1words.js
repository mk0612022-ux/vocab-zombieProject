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
};
