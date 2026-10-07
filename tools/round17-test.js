// Dev-only (not shipped). New series, round 3: four languages.
//   H1 Settings > Language: the UI, Word and Meaning languages, each of the
//      four named in itself; the other side's language locked; Swap; Word and
//      Meaning from the lobby only; saves from before languages
//   H2 every UI string in four languages (keys and {placeholders}), changed
//      at any time, the screen in view written again
//   H3 the word bank in four languages: every entry, its own part of speech,
//      pinyin with tones, a French noun's gender; no two words of a level
//      with the same meaning in any language; memory boxes per language
//   H4 pinyin over Chinese (DOM and the zombies' labels, a setting), a French
//      noun's gender, fonts, speech in the Word Language and what happens
//      when the device has no voice for it
//   H5 the modes: English-only ones locked with the reason; spelling by
//      language (French accents and Strict accents, Chinese characters or
//      toneless pinyin, Thai clusters, IME), the player's own words with
//      their languages
// Load it into the game (past the Start screen, in the lobby), then:
//   const r = await G.Round17Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round17Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const S = () => G.save.settings;
  const LANGS = ["th", "en", "zh", "fr"];
  const setLangs = (wl, ml) => { S().wordLang = wl; S().meaningLang = ml; G.Lang.apply(); };
  const uiLang = (l) => new Promise((res) => G.setUILang(l, { done: res }));
  const find = (id, lv) => (lv ? G["WORDS_LEVEL_" + lv] : G.getAllBuiltinWords()).find((p) => p.id === id);
  const THAI_MARK = new RegExp("^[" + String.fromCharCode(0x0E31) + String.fromCharCode(0x0E34) + "-" + String.fromCharCode(0x0E3A) + String.fromCharCode(0x0E47) + "-" + String.fromCharCode(0x0E4E) + "]");
  const HAN = /^[㐀-鿿]+$/;
  const TONED = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
  // a device with only these voices (stubbed), the old list back afterwards
  const withVoices = (langs) => {
    const ss = window.speechSynthesis;
    const had = Object.prototype.hasOwnProperty.call(ss, "getVoices"), real = ss.getVoices;
    ss.getVoices = () => langs.map((l) => ({ lang: l, name: "Test " + l, voiceURI: "test-" + l }));
    const known = G.Audio._voicesKnown;
    G.Audio._voicesKnown = true;
    return () => { if (had) ss.getVoices = real; else delete ss.getVoices; G.Audio._voicesKnown = known; };
  };

  // ---------------- H3: the word bank ----------------
  function bank() {
    const all = G.WordBank.entries();
    const bad = all.filter((e) => !e.zh || !e.pinyin || !e.zhPos || !e.fr || !e.frPos || !e.thai || !e.headword);
    ok("H3 every entry in four languages (en, th, zh, fr)", all.length === 886 && !bad.length, all.length + " entries, incomplete: " + bad.map((e) => e.id).slice(0, 5).join());
    const noTone = all.filter((e) => !TONED.test(e.pinyin));
    const notHan = all.filter((e) => !HAN.test(e.zh));
    ok("H3 Chinese: characters, and pinyin with tone marks", !noTone.length && !notHan.length, noTone.concat(notHan).map((e) => e.id).slice(0, 5).join());
    const nouns = all.filter((e) => G.POS.parts(e.frPos).includes("n"));
    const noG = nouns.filter((e) => !/^(m|f|m\/f)$/.test(e.frGender || ""));
    ok("H3 French: every noun with its gender (m, f, m/f)", nouns.length > 300 && !noG.length, nouns.length + " nouns, without: " + noG.map((e) => e.id).slice(0, 5).join());
    const ownPos = all.filter((e) => e.zhPos !== e.partOfSpeech || e.frPos !== e.partOfSpeech);
    ok("H3 each language its own part of speech (some differ from the English)", ownPos.length > 5 && all.every((e) => G.POS.valid(e.zhPos) && G.POS.valid(e.frPos)), ownPos.length + " differ, e.g. " + ownPos.slice(0, 3).map((e) => e.id + " " + e.partOfSpeech + "/" + e.zhPos + "/" + e.frPos).join(", "));
    const review = all.filter((e) => (e.review || []).length);
    ok("H3 the entries to check are marked (review)", review.length > 0 && review.every((e) => e.review.every((l) => ["th", "zh", "fr"].includes(l))), review.map((e) => e.id + "(" + e.review.join() + ")").join(", "));
    // no two words of a level with the same meaning, in every language
    const dups = [];
    [1, 2, 3].forEach((lv) => LANGS.forEach((l) => {
      const seen = new Map();
      G.WordBank.entries(lv).forEach((e) => { const t = G.Lang.text(e, l).trim().toLowerCase(); if (seen.has(t)) dups.push(lv + ":" + l + ":" + t); else seen.set(t, e.id); });
    }));
    ok("H3 no two words of a level with the same meaning, in any language", !dups.length, dups.slice(0, 5).join(", "));
  }

  // ---------------- H1 + H3: the languages, the lists, the keys ----------------
  function engine() {
    const fresh = G.normalizeSave({ unlockedLevels: [1], settings: { graphicsQuality: "low" } });
    ok("H1 a save from before languages: English menus, English words, Thai meanings", fresh.settings.uiLang === "en" && fresh.settings.wordLang === "en" && fresh.settings.meaningLang === "th" && fresh.settings.pinyin === true && fresh.settings.strictAccents === false);
    const same = G.normalizeSave({ settings: { wordLang: "fr", meaningLang: "fr", uiLang: "xx" } });
    ok("H1 the Meaning Language can never be the Word Language (a broken save is mended)", same.settings.wordLang === "fr" && same.settings.meaningLang !== "fr" && same.settings.uiLang === "en", same.settings.meaningLang);
    // the twelve pairs
    const pairs = [];
    LANGS.forEach((wl) => LANGS.forEach((ml) => { if (wl !== ml) pairs.push([wl, ml]); }));
    const bad = [];
    pairs.forEach(([wl, ml]) => {
      setLangs(wl, ml);
      [1, 2, 3].forEach((lv) => {
        const list = G["WORDS_LEVEL_" + lv];
        if (list.length !== G.WordBank.count(lv)) bad.push(wl + ml + lv + " size");
        list.forEach((p) => { const e = G.WordBank.byId(p.id); if (p[0] !== G.Lang.text(e, wl) || p[1] !== G.Lang.text(e, ml) || p.wl !== wl || p.ml !== ml || !p[0] || !p[1]) bad.push(wl + ml + " " + p.id); });
      });
    });
    ok("H1 all twelve pairs: every level's words in the Word Language, meanings in the Meaning Language", pairs.length === 12 && !bad.length, bad.slice(0, 5).join());
    setLangs("zh", "en");
    const z = find("analyse", 1);
    setLangs("en", "th");
    const e = find("analyse", 1);
    ok("H3 memory boxes per language: analyse@zh beside analyse (English, as every old record)", G.wordKey(z) === "analyse@zh" && G.wordKey(e) === "analyse" && G.wordKey.en("Analyse") === "analyse" && G.wordKey.en("consist") === "consistent");
    const backup = JSON.stringify(G.save.learn);
    const before = G.SRS.box(e);
    setLangs("zh", "th");
    G.Learning.answerWord(find("analyse", 1), true, {});
    const zhBox = G.SRS.box(find("analyse", 1));
    setLangs("en", "th");
    ok("H3 a word answered in Chinese moves its Chinese box, not its English one", zhBox >= 1 && G.SRS.box(find("analyse", 1)) === before, "zh " + zhBox + ", en " + before + " -> " + G.SRS.box(find("analyse", 1)));
    G.save.learn = JSON.parse(backup);
    const mig = G.migrateWordStats({ analyse: { correct: 2, wrong: 1, lastCorrect: 5 }, "analyse@zh": { correct: 1, wrong: 0, lastCorrect: 9 }, consist: { correct: 1, wrong: 0, lastCorrect: 1 } });
    ok("H3 old stats stay English; a language's own records are kept apart", mig.analyse && mig["analyse@zh"] && mig["analyse@zh"].correct === 1 && !mig.consist && mig.consistent, Object.keys(mig).join());
  }

  // ---------------- H4: display ----------------
  function display() {
    setLangs("zh", "th");
    const p = find("analyse", 1);
    const html = G.Lang.html(p, 0);
    ok("H4 pinyin over Chinese characters (ruby)", /<ruby>[^<]+<rt>[^<]+<\/rt><\/ruby>/.test(html) && html.indexOf(p.pyW) > 0, html);
    S().pinyin = false;
    const off = G.Lang.html(p, 0);
    S().pinyin = true;
    ok("H4 the pinyin setting turns it off", off === G.escapeHtml(p[0]));
    // a zombie's label: pinyin over its Chinese word, the part of speech after it
    const zz = new G.Zombie("normal", new THREE.Vector3(0, 0, 0), p, "school");
    zz.setAnswer("shoot", p[1], { kind: "thai" });
    zz.setTarget(false);
    const withRuby = zz.sprite.userData.canvas.__fh;
    ok("H4 a zombie's Chinese word carries its pinyin above it", zz.labelRuby() === p.pyW && zz.labelPos() === G.POS.short(p) && withRuby > 0.5, zz.labelRuby() + " " + zz.labelPos() + " fh " + withRuby.toFixed(2));
    setLangs("th", "zh");
    const t = find("analyse", 1), zt = new G.Zombie("normal", new THREE.Vector3(0, 0, 0), t, "school");
    zt.setAnswer("spell", t[1], { kind: "thai" });
    ok("H4 a Chinese meaning on a zombie carries its pinyin too", zt.labelRuby() === t.pyM, zt.labelRuby());
    setLangs("fr", "th");
    const f = find("approach", 1);
    ok("H4 a French noun with its gender: approche (N. f.)", G.POS.text(f[0], f) === "approche (N. f.)" && G.POS.tag(f).indexOf("(N. f.)") > 0, G.POS.text(f[0], f));
    const pot = find("potential", 1);
    ok("H4 a two-part French entry: the noun's gender with its noun", G.POS.short(pot) === "N. m./Adj.", G.POS.short(pot));
    setLangs("en", "th");
    const two = G.getAllBuiltinWords().find((x) => G.WordBank.byId(x.id).partOfSpeech === "n/v");
    ok("H4 English stays as it was: " + (two && two[0]) + " (N./V.)", two && G.POS.short(two) === "N./V.");
    // fonts
    const css = getComputedStyle(document.documentElement).getPropertyValue("--font-ui");
    ok("H4 one font list for Latin with accents, Thai and Chinese (UI and labels)", /Leelawadee|Noto Sans Thai/.test(css) && /YaHei|PingFang|Noto Sans SC/.test(css) && /YaHei/.test(G.LABEL_FONTS.cjk) && /Tahoma|Leelawadee/.test(G.LABEL_FONTS.thai), css.trim().slice(0, 80));
    // the boss words, the Word of the Day, the vocabulary card
    const bw = { word: "relentless" };
    setLangs("en", "zh");
    const mzh = G.Bosses.meaning(bw);
    setLangs("zh", "en");
    const men = G.Bosses.meaning(bw);
    setLangs("en", "fr");
    const mfr = G.Bosses.meaning(bw);
    ok("H4 a boss word's meaning in the Meaning Language", mzh.lang === "zh" && HAN.test(mzh.text) && mzh.py && men.lang === "en" && /never/.test(men.text) && mfr.text === "implacable", [mzh.text, men.text, mfr.text].join(" | "));
    setLangs("fr", "th");
    const w = G.Boot.wordOfTheDay(), we = G.WordBank.byText(w.word, "fr");
    ok("H4 the Word of the Day in the Word and Meaning Language", !!we && w.thai === we.thai, w.word + " = " + w.thai);
    setLangs("zh", "th");
    const card = G.VocabCard.cardHtml(find("analyse", 1));
    setLangs("en", "th");
    const cardEn = G.VocabCard.cardHtml(find("analyse", 1));
    ok("H4 the card: the word in its language with pinyin, the other languages, English parts only for English", /<ruby>/.test(card) && /vc-other/.test(card) && !/vc-def/.test(card) && /vc-def/.test(cardEn), "");
  }

  // ---------------- H4: speech ----------------
  function speech() {
    const ss = window.speechSynthesis;
    if (!ss) { ok("H4 speech (no speechSynthesis here)", true, "skipped"); return; }
    const restore = withVoices(["en-GB", "fr-FR", "th-TH"]);
    const realSpeak = ss.speak, realCancel = ss.cancel, said = [];
    ss.speak = (u) => said.push({ text: u.text, lang: u.lang });
    ss.cancel = () => {};
    const vol = S().speechVolume;
    S().speechVolume = 0.9;
    try {
      setLangs("fr", "th");
      G.Audio.speak(find("approach", 1)[0]);
      setLangs("th", "en");
      G.Audio.speak(find("ability", 1)[0]);
      ok("H4 a word is said in the Word Language's voice", said.length === 2 && /^fr/.test(said[0].lang) && /^th/.test(said[1].lang), JSON.stringify(said));
      setLangs("zh", "th");
      said.length = 0;
      G.Audio.speak(find("analyse", 1)[0]);
      const p = find("analyse", 1);
      ok("H4 no Chinese voice: nothing is said, and the heard modes and questions are off with the reason",
        !said.length && !G.Audio.canSpeak("zh") && !G.Learn.available("listening") && !G.Learn.available("dictation") && /voice/i.test(G.Learn.whyNot("listening")) && !G.Questions.can("listen", p) && !G.Questions.can("dictation", p) && !G.Clues.has(p, "audio"),
        G.Learn.whyNot("listening"));
      G.Lobby._noticeClosed = null; G.UI.goToMainMenu();
      const note = $("lobby-notice");
      const shown = note && !note.classList.contains("hidden") && /voice/i.test(note.textContent);
      if (note && note.querySelector(".ln-x")) note.querySelector(".ln-x").click();
      ok("H4 ...and the lobby says so (a line that can be closed)", shown && note.classList.contains("hidden"));
      setLangs("en", "th");
      ok("H4 English with an English voice: Listening and Dictation are there", G.Learn.available("listening") && G.Learn.available("dictation"));
    } finally {
      ss.speak = realSpeak; ss.cancel = realCancel; S().speechVolume = vol;
      restore();
    }
  }

  // ---------------- H5: the modes ----------------
  function modes() {
    setLangs("fr", "zh");
    const p = find("approach", 1);
    const locked = ["paraphrase", "context"].every((m) => !G.Learn.available(m) && /English/i.test(G.Learn.whyNot(m)));
    const questions = ["def2word", "cloze", "colloc", "paraphrase", "defspell", "clozespell"].every((q) => !G.Questions.can(q, p));
    let english = 0;
    for (let i = 0; i < 300; i++) { const t = G.Questions.pickType(p, null); if (["def2word", "cloze", "colloc", "paraphrase"].includes(t)) english++; }
    const plain = ["classic", "spelling", "adaptive"].every((m) => G.Learn.available(m));
    ok("H5 another Word Language: Paraphrase, Context and the English questions are off (with why), the rest are there", locked && questions && !english && plain, G.Learn.whyNot("paraphrase"));
    ok("H5 ...no syllables, no misspelling tips, no marked words in the notes", !G.Clues.stressHtml(p) && G.Spell.tipFor("aproche", p) === "" && G.VocabCard.markNote("<p>analysis</p>", "level1") === "<p>analysis</p>");
    G.Progress.tab = "learn"; G.Progress.render();
    const awlOff = !!document.querySelector("#progress-body .pg-off");
    setLangs("en", "th");
    G.Progress.render();
    const awlOn = !document.querySelector("#progress-body .pg-off") && !!document.querySelector("#progress-body .pg-rows");
    ok("H5 the AWL count on Progress: English words only", awlOff && awlOn);
    ok("H5 English: every mode and question kind is back", G.Learn.available("paraphrase") && G.Learn.available("context") && G.Questions.can("def2word", find("approach", 1)) && /note-word/.test(G.VocabCard.markNote("<p>analysis</p>", "level1")));
    // a question in two languages
    setLangs("fr", "th");
    const q = G.Questions.build(find("approach", 1), "th2en", G.WORDS_LEVEL_1);
    const q2 = G.Questions.build(find("approach", 1), "en2th", G.WORDS_LEVEL_1);
    ok("H5 the end-of-wave quiz both ways: word and meaning each in its language", q.prompt.lang === "th" && q.choices.every((c) => c.lang === "fr") && q2.prompt.lang === "fr" && q2.choices.every((c) => c.lang === "th"),
      q.choices.map((c) => c.text).join(", "));
    setLangs("zh", "th");
    const qz = G.Questions.build(find("analyse", 1), "th2en", G.WORDS_LEVEL_1);
    ok("H5 ...Chinese choices with their pinyin", qz.choices.every((c) => /<ruby>/.test(c.html)));
    const r = G.Distract.resolve("analyse@zh");
    ok("H5 a word confused in Chinese is a Chinese pair (look-alikes per language)", r && r[0] === find("analyse", 1)[0] && r.wl === "zh");
    setLangs("en", "th");
  }

  // ---------------- H5: spelling ----------------
  function spelling() {
    const Sp = G.Spell, U = G.SpellUnits;
    setLangs("fr", "th");
    const est = find("establish", 1), word = est[0];
    const bare = U.fold(word);
    S().strictAccents = false;
    const loose = Sp.isRight(bare, est) && Sp.accentFix(bare, est) === word && Sp.isRight(word, est) && Sp.accentFix(word, est) === "";
    S().strictAccents = true;
    const strict = !Sp.isRight(bare, est) && Sp.isRight(word, est);
    S().strictAccents = false;
    ok("H5 French: a missing accent is right (the word shown with its accents) -- unless Strict accents", word !== bare && loose && strict, word + " / " + bare);
    // the pad: a text field, the accent buttons
    const box = document.createElement("div");
    document.body.appendChild(box);
    let submitted = null;
    const pad = new G.SpellPad(box, { mode: "type", onSubmit: (t) => { submitted = t; } });
    pad.setWord(est, est[1]);
    const accents = box.querySelectorAll(".spad-tiles button[data-acc]").length;
    pad.input.value = "tabli"; pad.input.dispatchEvent(new Event("input"));
    pad.insert(word[0]);
    ok("H5 French typing: a real text field, and the accent buttons (é è ê à â ç î ô ù û)", pad.usesField() && accents === 10 && pad.text() === "tabli" + word[0], pad.text());
    // IME: never answered while composing
    const q = { spell: true, prompt: {} };
    let answered = 0;
    const h = { spell: () => { answered++; } };
    pad.composing = true;
    G.QuestionView.key({ code: "Enter", key: "Enter", isComposing: true, keyCode: 229, preventDefault() {} }, q, pad, h);
    pad.composing = false;
    G.QuestionView.key({ code: "Enter", key: "Enter", preventDefault() {} }, q, pad, h);
    ok("H5 an IME's Enter chooses a character: it never answers while composing", answered === 1);
    box.remove();
    // Chinese: the characters, or the pinyin without tones
    setLangs("zh", "th");
    const an = find("analyse", 1), dis = find("discipline", 1);
    ok("H5 Chinese: the characters, or the pinyin without tones (v or u for the u with dots)",
      Sp.isRight(an[0], an) && Sp.isRight("fenxi", an) && Sp.isRight("fen xi", an) && !Sp.isRight("fenxe", an) && Sp.isRight("jilv", dis) && Sp.isRight("jilu", dis), an[0] + " " + dis.pyW);
    const box2 = document.createElement("div");
    document.body.appendChild(box2);
    const tp = new G.SpellPad(box2, { mode: "tiles" });
    tp.setWord(an, an[1]);
    const tiles = tp.tiles.map((x) => x.ch);
    ok("H5 Chinese tiles: the word's characters and other characters to put them together from", tiles.length >= 4 && Array.from(an[0]).every((c) => tiles.includes(c)) && tiles.every((c) => HAN.test(c)), tiles.join(" "));
    // Thai: grapheme clusters
    setLangs("th", "en");
    const im = find("immunity", 2);
    tp.setWord(im, im[1]);
    const units = U.split(im[0], "th").map((u) => u.ch);
    ok("H5 Thai tiles: whole clusters -- no tile is a mark on its own", units.join("") === im[0] && units.every((u) => !THAI_MARK.test(u)) && units.length < Array.from(im[0]).length && tp.tiles.every((t) => !THAI_MARK.test(t.ch)), units.join("|"));
    tp.mode = "tiles"; tp.setWord(im, im[1]);
    units.forEach((u) => { const i = tp.tiles.findIndex((t) => !t.used && t.ch === u); if (i >= 0) tp.place(i); });
    ok("H5 ...put together in order, the word is right", tp.text() === im[0] && Sp.isRight(tp.text(), im));
    box2.remove();
    setLangs("en", "th");
    ok("H5 English typing is as before (keys, no text field)", (() => { const b = document.createElement("div"); const p2 = new G.SpellPad(b, { mode: "type" }); p2.setWord(find("approach", 1), ""); return !p2.usesField(); })());
  }

  // ---------------- H5: the player's own words ----------------
  function custom() {
    const CV = G.CustomVocab;
    const keep = JSON.stringify(G.save.customWords);
    try {
      const r = CV.save("testword", "a made-up meaning", "level1", null, null, { wl: "zh", ml: "en" });
      const r2 = CV.save(String.fromCharCode(0x6D4B, 0x8BD5, 0x8BCD), "a made-up meaning", "level1", null, null, { wl: "zh", ml: "en" });
      const stored = CV.list("level1")[CV.list("level1").length - 1];
      ok("H5 your own word: checked in its languages, kept with them", r.error === "cv.errLetters.zh" && r2.ok && stored[2] && stored[2].wl === "zh" && stored[2].ml === "en", r.error);
      setLangs("zh", "en");
      const inZh = G.levelWords("level1").some((p) => p[0] === r2.word && p.wl === "zh");
      setLangs("en", "zh");
      const rev = G.levelWords("level1").find((p) => p[1] === r2.word);
      setLangs("en", "th");
      const inEnTh = G.levelWords("level1").some((p) => p[0] === r2.word || p[1] === r2.word);
      ok("H5 ...in play only with its pair of languages, or the reverse (asked the other way round)", inZh && rev && rev[0] === "a made-up meaning" && !inEnTh);
      ok("H5 ...an old word (no languages) is English > Thai", CV.langsOf(["word", "x"]).wl === "en" && CV.langsOf(["word", "x"]).ml === "th");
      ok("H5 ...a word and its meaning in the same language is refused", CV.checkFields("abc", "abc", { wl: "fr", ml: "fr" }) === "cv.errSameLang");
      // the page: the two language choices
      G.CustomVocabUI.tab = "level1";
      G.CustomVocabUI.open("screen-mainmenu");
      const opts = $("cv-wl").options.length, ml = $("cv-ml").value, wl = $("cv-wl").value;
      ok("H5 the Custom Vocabulary page: the word's and the meaning's language", opts === 4 && wl === G.Lang.word() && ml === G.Lang.meaning() && document.querySelectorAll("#cv-list .cv-langs").length >= 1);
      G.UI.goToMainMenu();
    } finally {
      G.save.customWords = JSON.parse(keep); CV.invalidate();
    }
  }

  // ---------------- H1: the Settings page ----------------
  async function settings() {
    setLangs("en", "th");
    G.UI._settingsReturn = "screen-mainmenu"; G.UI.renderSettings(); G.UI.showScreen("screen-settings"); G.SettingsUI.select("language");
    const opts = (id) => Array.from(document.querySelectorAll("#" + id + " .seg-o"));
    const names = opts("set-uilang").map((b) => b.textContent.trim());
    ok("H1 four languages, each named in itself: " + names.join(", "), names.length === 4 && names.includes("English") && names.includes(G.Lang.NAMES.th) && names.includes(G.Lang.NAMES.zh) && names.includes(G.Lang.NAMES.fr));
    const takenW = opts("set-wordlang").filter((b) => b.disabled), takenM = opts("set-meanlang").filter((b) => b.disabled);
    ok("H1 the other side's language greyed out, with a lock and why", takenW.length === 1 && takenW[0].dataset.v === "th" && takenW[0].classList.contains("lang-taken") && takenW[0].querySelector(".lang-lock") && takenW[0].title
      && takenM.length === 1 && takenM[0].dataset.v === "en", takenW[0] && takenW[0].title);
    $("btn-lang-swap").click();
    await wait(50);
    ok("H1 Swap turns the Word and Meaning Language round", S().wordLang === "th" && S().meaningLang === "en" && G.WORDS_LEVEL_1[0].wl === "th");
    const zh = opts("set-wordlang").find((b) => b.dataset.v === "zh");
    S().pinyin = false;
    zh.click();
    await wait(50);
    ok("H1 Chinese as the Word Language turns pinyin on", S().wordLang === "zh" && S().pinyin === true && G.WORDS_LEVEL_1[0].wl === "zh");
    const strict = $("set-strictacc"), pin = $("set-pinyin");
    ok("H1 the pinyin and Strict accents switches", !!strict && !!pin);
    // in a run: Word and Meaning locked
    G.UI._settingsReturn = "screen-pause"; G.SettingsUI.render(); G.SettingsUI.select("language");
    const lockedW = opts("set-wordlang").every((b) => b.disabled), lockedSwap = $("btn-lang-swap").disabled, uiFree = opts("set-uilang").some((b) => !b.disabled);
    G.SettingsUI.setLangs({ word: "fr" });
    ok("H1 in a level: Word and Meaning locked (from the lobby only); the UI language still free", lockedW && lockedSwap && uiFree && S().wordLang === "zh");
    G.UI._settingsReturn = "screen-mainmenu";
    setLangs("en", "th");
    // H2: the UI language, at any time
    await uiLang("fr");
    G.SettingsUI.render(); G.SettingsUI.select("language");
    const head = document.querySelector("#set-sec-language .set-head h3").textContent;
    const back = document.querySelector("#btn-cv-back") && document.querySelector("#btn-cv-back").textContent;
    ok("H2 the menus in French at once: the page, the static text, <html lang>", G.lang === "fr" && head === "Langue" && back === "Retour" && document.documentElement.lang === "fr" && S().uiLang === "fr", head + " / " + back);
    await uiLang("en");
    G.UI.goToMainMenu();
  }

  // ---------------- H2: four languages of UI text ----------------
  async function strings() {
    const en = G.STRINGS.en, keys = Object.keys(en);
    const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
    for (const l of ["th", "zh", "fr"]) {
      await uiLang(l);
      const t = G.STRINGS[l] || {};
      const missing = keys.filter((k) => !(k in t)), extra = Object.keys(t).filter((k) => !(k in en));
      const badPh = keys.filter((k) => k in t && ph(t[k]) !== ph(en[k]));
      ok("H2 " + l + ": every key (" + keys.length + "), the same placeholders", !missing.length && !extra.length && !badPh.length, missing.concat(extra, badPh).slice(0, 5).join());
    }
    // the HUD parts that redraw only on a change are told to draw again
    if (G.Floor3) G.Floor3._hudSig = "stale";
    G.UI._hudPerkSig = "stale";
    await uiLang("th");
    G.UI.goToMainMenu();
    ok("H2 the HUD lines kept between frames are drawn again (third floor, perks)", (!G.Floor3 || G.Floor3._hudSig !== "stale") && G.UI._hudPerkSig !== "stale",
      (G.Floor3 && G.Floor3._hudSig) + " / " + G.UI._hudPerkSig);
    const speak = document.getElementById("hud-speak"), ver = document.querySelector("[data-version]"), tipH = document.getElementById("boot-tip-h");
    ok("H2 the short names under icons in the new language", speak && speak.dataset.label === G.T("hud.hearShort") && speak.dataset.label !== G.STRINGS.en["hud.hearShort"], speak && speak.dataset.label);
    ok("H2 the version in the corner and the Loading tip in the new language", (!ver || ver.textContent === G.Updater.label()) &&
      (!tipH || !tipH.textContent || tipH.textContent === G.T("boot.wotd") || tipH.textContent === G.T("boot.tipHead")), (ver && ver.textContent) + " / " + (tipH && tipH.textContent));
    const THAI = new RegExp("[" + String.fromCharCode(0x0E01) + "-" + String.fromCharCode(0x0E5B) + "]");
    const spaced = Array.from(document.querySelectorAll("#screen-mainmenu *")).filter((el) => !el.children.length && THAI.test(el.textContent) && !/^(normal|0px)$/.test(getComputedStyle(el).letterSpacing));
    ok("H4 Thai is never spaced out letter by letter (headings spaced in English)", !spaced.length, spaced.slice(0, 3).map((el) => el.className + ": " + getComputedStyle(el).letterSpacing).join());
    const tabs = Array.from(document.querySelectorAll(".lobby-tab")).map((b) => b.textContent);
    ok("H2 the lobby written again in the new language", tabs.join() === [G.T("lobby.tab.campaign"), G.T("lobby.tab.training")].join() && tabs[0] !== G.STRINGS.en["lobby.tab.campaign"], tabs.join());
    ok("H2 names stay English: the guns', the bosses'", G.T("weapon.golden_smg") === G.STRINGS.en["weapon.golden_smg"] && G.T("boss.gravedigger.name") === G.STRINGS.en["boss.gravedigger.name"]);
    await uiLang("en");
    ok("H2 the UI language's file is loaded only when chosen (the others on demand)", G.UI_LANG_FILES && Object.keys(G.UI_LANG_FILES).join() === "th,zh,fr" && typeof G.earlySettings === "object");
  }

  // ---------------- a level in Chinese ----------------
  async function play() {
    setLangs("zh", "th");
    const g = G.Game;
    G.Input.requestPointerLock = function () {};
    G.save.tutorialDone = true;
    g.startLevel(1);
    await wait(400);
    const realUpdate = g.update;
    g.update = function () {};
    try {
      g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
      const p = g.yawObject.position;
      for (let i = 0; i < 6; i++) g.spawnZombieAt("normal", p.clone().add(new THREE.Vector3((i - 3) * 2, -1.7, -9)), null);
      const words = g.zombies.map((z) => z.word), meanings = g.zombies.map((z) => z.meaning);
      ok("H5 a level in Chinese: the zombies carry Chinese words, never two with the same meaning",
        g.zombies.length === 6 && words.every((w) => HAN.test(w) || /\s/.test(w)) && new Set(meanings).size === meanings.length, words.join(" "));
      ok("H4 ...with their pinyin over them", g.zombies.every((z) => z.labelText !== z.word || !!z.labelRuby()));
      // the meaning at the top of the screen in Chinese: its pinyin over it
      // (a level keeps the words it started with: a new one would start with these)
      setLangs("th", "zh");
      g.wordPool = G.WORD_SETS[g.level.wordsKey].words; g.wavePlan = null;
      g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
      g.spawnZombieAt("normal", p.clone().add(new THREE.Vector3(0, -1.7, -9)), null);
      g.targetPair = g.zombies[0].pair; g.targetClue = null;
      G.UI.updateHud(g.buildHudState());
      const hm = $("hud-meaning");
      ok("H4 the meaning at the top in Chinese, with its pinyin over it", hm.querySelector("ruby rt") && hm.querySelector("ruby rt").textContent === g.targetPair.pyM && hm.lang === "zh-Hans", hm.innerHTML.slice(0, 80));
    } finally {
      g.update = realUpdate;
      g.quitToMainMenu();
    }
    setLangs("en", "th");
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save);
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    const realLock = G.Input.requestPointerLock, mode = G.Input.mode, lang0 = G.lang;
    G._missingKeys = {};
    try {
      G.Input.mode = "desktop";
      bank();
      engine();
      display();
      speech();
      modes();
      spelling();
      custom();
      await settings();
      await strings();
      await play();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Input.requestPointerLock = realLock;
      G.Input.mode = mode;
      G.Modal.reset();
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.Lang.apply();
      if (G.lang !== lang0) await uiLang(lang0);
      G.UI.goToMainMenu();
    }
    const missing = Object.keys(G._missingKeys || {});
    ok("no missing strings", !missing.length, missing.join());
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
