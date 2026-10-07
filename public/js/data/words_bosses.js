// ===================================================================
// The ten bosses' titles (new list, round 2, G4): each boss is called
// "<name> the <word>", the word one of C1-C2 level, and its meaning is
// shown small under the title card in the boss's cutscene and in the Boss
// Codex -- a word learnt at every boss. (Vocabulary data: the Thai here is
// part of the game, like the word bank in js/data/bank_*.js.) (Round 3, H: the
// meaning in each Meaning Language -- th, zh with its pinyin, fr, and en, a
// short English gloss for a player whose words are in another language.)
// ===================================================================
window.G = window.G || {};
G.BOSS_WORDS = {
  relentless: { th: "ไม่ลดละ", zh: "坚持不懈", py: "jiānchí bùxiè", fr: "implacable", en: "never stopping or easing", cefr: "C1" },
  omniscient: { th: "รอบรู้ทุกสิ่ง", zh: "无所不知", py: "wúsuǒ bùzhī", fr: "omniscient", en: "knowing everything", cefr: "C2" },
  tyrannical: { th: "กดขี่ข่มเหง", zh: "专横", py: "zhuānhèng", fr: "tyrannique", en: "using power cruelly and unfairly", cefr: "C2" },
  prolific: { th: "มีผลผลิตมากมาย", zh: "多产", py: "duōchǎn", fr: "prolifique", en: "producing a great many things", cefr: "C2" },
  indomitable: { th: "ไม่ยอมพ่ายแพ้", zh: "不屈不挠", py: "bùqū bùnáo", fr: "indomptable", en: "impossible to defeat", cefr: "C2" },
  tenacious: { th: "เหนียวแน่น ไม่ยอมปล่อย", zh: "顽强", py: "wánqiáng", fr: "tenace", en: "holding on firmly, never giving up", cefr: "C2" },
  capricious: { th: "เอาแน่เอานอนไม่ได้", zh: "反复无常", py: "fǎnfù wúcháng", fr: "capricieux", en: "changing suddenly for no reason", cefr: "C2" },
  malevolent: { th: "มุ่งร้าย", zh: "恶毒", py: "èdú", fr: "malveillant", en: "wishing to do harm to others", cefr: "C2" },
  insatiable: { th: "ไม่รู้จักพอ", zh: "贪得无厌", py: "tāndé wúyàn", fr: "insatiable", en: "never satisfied", cefr: "C2" },
  duplicitous: { th: "ตีสองหน้า", zh: "两面三刀", py: "liǎngmiàn sāndāo", fr: "fourbe", en: "deceiving people, two-faced", cefr: "C2" },
};
