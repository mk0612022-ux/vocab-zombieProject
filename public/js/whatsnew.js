// ===================================================================
// "What's new" (expansion, round 9): once after an update, a short window on
// what the update brought -- the stat cards, the Word Forge, attachments and
// skins, the melee weapons, the Training Yard and tips, backups and reports --
// in the player's language. It comes up on the Main Menu, once for each
// player who played before these notes came. A player new to the game is not
// shown them (the Training Yard is offered instead): for them the notes are
// marked read.
//
//   G.WhatsNew.maybeShow()  from js/mainmenu.js show(): opens it when it is due
//   G.WhatsNew.open()       the window itself, whenever asked for
//   G.WhatsNew.due()        could it come up now (the flag on, not read, the
//                           menus up and no window open)?
//   G.WhatsNew.seen()       read already: G.save.tutorialSeen["news_" + id]
// The lines are data: G.CONFIG.whatsNew.items (an icon, news.<key>.t / .d).
// A G.Dialog window: mouse, touch, keys (Enter, Esc, 1-2) and a controller.
// ===================================================================
window.G = window.G || {};

G.WhatsNew = (function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const C = () => G.CONFIG.whatsNew || { id: "", items: [] };
  const on = () => !!(G.CONFIG.expansion && G.CONFIG.expansion.whatsNew) && !!C().id;
  const key = () => "news_" + C().id;

  function seen() { return !!(G.save && G.save.tutorialSeen && G.save.tutorialSeen[key()]); }
  function mark() {
    if (!G.save) return;
    G.save.tutorialSeen = G.save.tutorialSeen || {};
    G.save.tutorialSeen[key()] = true;
    G.persist();
  }
  // new to the game: nothing learnt, no score, the first level's cards never seen
  // (the Training Yard's own rule when it is there)
  function isNew() {
    if (G.TrainingYard && G.TrainingYard.isNew) return G.TrainingYard.isNew();
    const S = G.save;
    const srs = S.learn && S.learn.srs ? Object.keys(S.learn.srs).length : 0;
    return !srs && !Object.keys(S.levelHighScores || {}).length && !S.tutorialDone;
  }
  // the keys a line names, as this player has them bound
  function vars() {
    const kb = (G.save && G.save.settings && G.save.settings.keybinds) || {};
    const lab = (c) => (c && G.keyLabel ? G.keyLabel(c) : "");
    return { melee: lab(kb.quickMelee) || "Z", report: lab(kb.report) || "F8" };
  }
  function body() {
    const v = vars();
    return `<p class="news-intro">${esc(T("news.intro", { n: C().items.length }))}</p><ul class="news-list">`
      + C().items.map((it) => `<li class="news-item" data-news="${esc(it.key)}"><span class="news-icon" aria-hidden="true">${esc(it.icon)}</span>`
        + `<span class="news-txt"><b>${esc(T("news." + it.key + ".t"))}</b><span>${esc(T("news." + it.key + ".d", v))}</span></span></li>`).join("")
      + `</ul>`;
  }
  function open() {
    if (!G.Dialog) return false;
    G.Dialog.open({
      icon: "✨", title: T("news.title"), cls: "news-box", body: body(),
      buttons: [
        { label: T("news.help"), action: () => { mark(); if (G.UI) G.UI.showScreen("screen-howtoplay"); } },
        { label: T("news.ok"), primary: true, cancel: true, action: () => mark() },
      ],
    });
    return true;
  }
  function due() {
    if (!on() || !G.save || seen()) return false;
    return !!G.Game && G.Game.state === "MENU" && !G.Modal.isOpen();
  }
  // from the Main Menu: once, for a player who played before these notes
  function maybeShow() {
    if (!due()) return false;
    if (isNew()) { mark(); return false; }
    return open();
  }
  return { open, due, seen, maybeShow, isNew, key, body, on };
})();
