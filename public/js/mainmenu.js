// ===================================================================
// The Main Menu (overhaul, round 5) -- in place of "Tap To Lobby"
// -------------------------------------------------------------------
// Loading -> here -> PLAY -> the lobby (js/lobby.js, its Back comes here).
//   the scene    a real 3D place behind the menu (js/menuscene.js): the
//                corridor, the steel door and its red lamp, the survivor
//                keeping watch on the right -- always moving a little
//   the logo     VOCAB ZOMBIE / IELTS SURVIVAL, block letters drawn as SVG
//                (sharp at any size; worn a little by an SVG filter)
//   the menu     a compact panel on the left, in four groups: play (PLAY,
//                DAILY REVIEW with the words due), learn (PROGRESS, VOCAB,
//                NOTES, CUSTOM), collect (WEAPONS, BOSSES, RANKS, AWARDS),
//                system (SETTINGS, HELP) -- each opens the page it always
//                did, and that page's Back comes here
//   input        mouse (a soft tick once on entering a button), keys (up and
//                down, Enter, Esc), a controller (D-pad or stick, A, B),
//                touch (44 px targets, no hover sound)
//   the corners  until the first touch or key the browser will not play
//                sound: "Click / tap to enable sound" -- then the music
//                fades in; the player and Sign In (accounts are still to
//                come), the version, an update when there is one
//   sound        the generative score (G.Audio.menuMusic) and the facility
//                around the camera: the fan, the panels' hum, machinery
//                behind the door, the wind down the corridor, now and then a
//                creak of metal or a knock from the dark -- each from where
//                it is, in an underground room's reverb
// The scene is drawn by the game's own renderer (one WebGL context), only
// while it is on screen (a page over it: a third of the frames); a level
// leaves it waiting, undrawn and silent (it is small; building it again would
// cost seconds of shader compiling).
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));

  // ---------------- the logo: block letters, 5 x 7 ----------------
  const GLYPH = {
    V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."], O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"], A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."], Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"], I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"], L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."], S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."], R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  };
  // a word in block letters: rects at (x0 + col * cw, y0 + row * ch)
  function word(text, x0, y0, cw, ch, gap, fill) {
    let out = "", x = x0;
    for (const c of text) {
      if (c === " ") { x += cw * 3; continue; }
      const g = GLYPH[c];
      if (g) g.forEach((row, r) => { for (let k = 0; k < 5; k++) if (row[k] === "#") out += `<rect x="${(x + k * cw).toFixed(2)}" y="${(y0 + r * ch).toFixed(2)}" width="${(cw + 0.06).toFixed(2)}" height="${(ch + 0.06).toFixed(2)}"/>`; });
      x += cw * 5 + gap;
    }
    return { svg: `<g fill="${fill}">${out}</g>`, width: x - x0 - gap };
  }
  function logoSVG() {
    // VOCAB in bone white, ZOMBIE in dark red, IELTS SURVIVAL small under them
    const cw = 3.3, ch = 4.6, gap = 2.2;
    const space = 9, top = word("VOCAB", 0, 0, cw, ch, gap, "#e9e6df");
    const red = word("ZOMBIE", top.width + space, 0, cw, ch, gap, "#a3161f"), total = top.width + space + red.width;
    // (measured at 0 first, then drawn centred under the two)
    const sw = 1.25, sh = 1.75, sg = 1.0, subW = word("IELTS SURVIVAL", 0, 0, sw, sh, sg, "").width;
    const sx = (total - subW) / 2, sy = ch * 7 + 5;
    const subG = word("IELTS SURVIVAL", sx, sy, sw, sh, sg, "#b9c8c2");
    const H = sy + sh * 7 + 2;
    return `<svg class="home-logo-svg" viewBox="-2 -2 ${(total + 4).toFixed(1)} ${(H + 4).toFixed(1)}" role="img" aria-label="VOCAB ZOMBIE: IELTS SURVIVAL" lang="en">
      <defs>
        <filter id="hl-wear" x="-5%" y="-5%" width="110%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.72" result="mask"/>
          <feComposite in="SourceGraphic" in2="mask" operator="in" result="worn"/>
          <feDropShadow in="worn" dx="0" dy="0.9" stdDeviation="0.9" flood-color="#000" flood-opacity="0.85"/>
        </filter>
      </defs>
      <g filter="url(#hl-wear)">${top.svg}${red.svg}${subG.svg}</g>
      <rect x="${(sx - 13).toFixed(1)}" y="${(sy + sh * 3.2).toFixed(1)}" width="9" height="0.55" fill="#b3262e"/>
      <rect x="${(sx + subG.width + 4).toFixed(1)}" y="${(sy + sh * 3.2).toFixed(1)}" width="9" height="0.55" fill="#b3262e"/>
    </svg>`;
  }

  // ---------------- the menu ----------------
  const GROUPS = [
    { id: "play", items: ["play", "review"] },
    { id: "learn", items: ["progress", "vocab", "notes", "custom"] },
    { id: "collect", items: ["weapons", "bosses", "ranks", "awards"] },
    { id: "system", items: ["settings", "help"] },
  ];

  // the pass after the scene on High and up (G.MainMenu.renderPost): FXAA, depth of
  // field at the far end, SSAO from the depth, three's ACES filmic curve (as
  // the plain path's) and sRGB
  const POST_VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  const POST_FRAG = [
    "uniform sampler2D tColor; uniform sampler2D tDepth;",
    "uniform vec2 uRes; uniform vec2 uCam; uniform float uTan; uniform float uFocus; uniform float uBlur; uniform float uAO; uniform float uExposure;",
    "varying vec2 vUv;",
    "float zAt(vec2 uv) { float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uCam.x * uCam.y / (uCam.y + uCam.x - z * (uCam.y - uCam.x)); }",
    "vec3 rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }",
    "vec3 aces(vec3 c) {",
    "  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));",
    "  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));",
    "  return clamp(OUT * rrtOdt(IN * (c * uExposure / 0.6)), 0.0, 1.0);",
    "}",
    "vec3 srgb(vec3 c) { return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }",
    // FXAA as the game's own (js/visuals.js): the target is not multisampled
    "vec3 fxaa(vec2 uv) {",
    "  vec2 px = 1.0 / uRes; const vec3 LU = vec3(0.299, 0.587, 0.114);",
    "  vec3 cNW = texture2D(tColor, uv + vec2(-1.0, -1.0) * px).rgb, cNE = texture2D(tColor, uv + vec2(1.0, -1.0) * px).rgb;",
    "  vec3 cSW = texture2D(tColor, uv + vec2(-1.0, 1.0) * px).rgb, cSE = texture2D(tColor, uv + vec2(1.0, 1.0) * px).rgb;",
    "  vec3 cM = texture2D(tColor, uv).rgb;",
    "  float lNW = dot(min(cNW, 1.0), LU), lNE = dot(min(cNE, 1.0), LU), lSW = dot(min(cSW, 1.0), LU), lSE = dot(min(cSE, 1.0), LU), lM = dot(min(cM, 1.0), LU);",
    "  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));",
    "  if (lMax - lMin < max(0.0312, lMax * 0.125)) return cM;",
    "  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));",
    "  float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);",
    "  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), -8.0, 8.0) * px;",
    "  vec3 a = 0.5 * (texture2D(tColor, uv - dir / 6.0).rgb + texture2D(tColor, uv + dir / 6.0).rgb);",
    "  vec3 b = a * 0.5 + 0.25 * (texture2D(tColor, uv - dir * 0.5).rgb + texture2D(tColor, uv + dir * 0.5).rgb);",
    "  float lB = dot(min(b, 1.0), LU);",
    "  return (lB < lMin || lB > lMax) ? a : b;",
    "}",
    "void main() {",
    "  vec3 c = max(fxaa(vUv), 0.0);",
    "  float z = zAt(vUv);",
    // a little depth of field: from twice the survivor's distance, softer with depth;
    // what is near is left out of the blur so it never bleeds into it
    "  float coc = clamp((z - uFocus * 2.0) / (uFocus * 4.0), 0.0, 1.0) * uBlur;",
    "  if (coc > 0.25) {",
    "    vec3 acc = c; float ws = 1.0;",
    "    for (int i = 0; i < 12; i++) {",
    "      float a = float(i) * 2.39996, rr = sqrt((float(i) + 0.5) / 12.0);",
    "      vec2 uv = vUv + vec2(cos(a), sin(a)) * rr * coc / uRes;",
    "      float w = step(uFocus * 1.5, zAt(uv));",
    "      acc += texture2D(tColor, uv).rgb * w; ws += w;",
    "    }",
    "    c = acc / ws;",
    "  }",
    // SSAO from the depth alone: nearer neighbours within a metre darken a corner
    // (a turned kernel per pixel; none far off, where the fog is)
    "  if (z < 14.0) {",
    "    float px = 0.4 * uRes.y / (2.0 * uTan * z);",
    "    float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2832;",
    "    float occ = 0.0;",
    "    for (int i = 0; i < 8; i++) {",
    "      float a = n + float(i) * 0.7854, rr = (float(i) + 1.0) / 8.0;",
    "      float d = z - zAt(vUv + vec2(cos(a), sin(a)) * px * rr / uRes);",
    "      occ += smoothstep(0.03, 0.1, d) * (1.0 - smoothstep(0.5, 1.0, d));",
    "    }",
    "    c *= 1.0 - uAO * (occ / 8.0) * (1.0 - smoothstep(9.0, 14.0, z));",
    "  }",
    "  gl_FragColor = vec4(srgb(aces(c)), 1.0);",
    "}",
  ].join("\n");

  G.MainMenu = {
    shown: false, built: false, scene: null, quality: null, post: null, focusI: 0, _t: 0, _frame: 0,
    held: false,                  // (a dev page over everything -- ?lab=zombies -- no scene, no sound)

    items() { return GROUPS.reduce((a, g) => a.concat(g.items), []); },
    build() {
      if (this.built) return;
      const root = $("screen-home");
      root.innerHTML = `
        <div class="home-vignette" aria-hidden="true"></div>
        <div class="home-logo">${logoSVG()}</div>
        <nav class="home-menu" id="home-menu" aria-label="${esc(T("home.menu"))}">
          ${GROUPS.map((g, gi) => `<div class="hm-group" data-group="${g.id}">
            <div class="hm-head">${esc(T("home.group." + g.id))}</div>
            ${g.items.map((id) => `<button type="button" class="hm-item${id === "play" ? " primary" : ""}" data-item="${id}"><span class="hm-mark" aria-hidden="true"></span><span class="hm-label">${esc(T("home.item." + id))}</span>${id === "review" ? `<span class="hm-badge hidden" id="home-due"></span>` : ""}</button>`).join("")}
          </div>${gi < GROUPS.length - 1 ? `<div class="hm-sep" aria-hidden="true"></div>` : ""}`).join("")}
        </nav>
        <button type="button" class="home-sound" id="home-sound"><span class="hs-icon" aria-hidden="true">🔇</span><span class="hs-text">${esc(T("home.sound"))}</span></button>
        <div class="home-foot">
          <span class="hf-who"><span aria-hidden="true">👤</span> <span id="home-name"></span></span>
          <button type="button" class="hf-signin" id="home-signin">${esc(T("account.signIn"))}</button>
          <span class="hf-ver" data-version></span>
        </div>
        <div class="home-rotate" aria-hidden="true">${esc(T("home.rotate"))}</div>`;
      this.btns = Array.from(root.querySelectorAll(".hm-item"));
      this.btns.forEach((b, i) => {
        b.onclick = () => { this.focusI = i; this.activate(b.dataset.item); };
        // a soft tick once on entering a button -- with a mouse, not a finger
        b.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") this.hover(i); });
        b.addEventListener("pointerleave", () => { if (this._hoverI === i) this._hoverI = null; });
        b.addEventListener("focus", () => { this.focusI = i; this.mark(); });
      });
      $("home-signin").onclick = (e) => { e.stopPropagation(); if (G.Account) G.Account.signIn(() => this.refresh()); };
      $("home-sound").onclick = () => this.wake();
      // the first touch, click or key anywhere on the page lets the sound start
      // (iOS lets it start only inside touchend or click: those too)
      ["pointerdown", "pointerup", "touchend", "click"].forEach((ev) => root.addEventListener(ev, () => this.wake(), { passive: true }));
      // the camera leans a little after the pointer
      root.addEventListener("pointermove", (e) => { if (this.scene) this.scene.point(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight * 2 - 1)); });
      window.addEventListener("resize", () => { if (this.scene) this.scene.fit(window.innerWidth, window.innerHeight); });
      this.built = true;
    },

    // from js/updater.js once Loading is done; and Back from the lobby
    show() {
      if (this.held) return;
      this.build();
      if (!this.scene) this.makeScene();
      this.shown = true;
      G.UI.menuOrigin = "home";
      document.body.classList.remove("over-home");
      G.UI.showScreen("screen-home");
      G.UI.setHudVisible(false); G.UI.setTouchControlsVisible(false);
      if (G.Game) G.Game.state = "MENU";
      this.refresh();
      this.wake(true);
      this.mark();
      setTimeout(() => { if (this.visible() && G.Input.mode !== "touch" && this.btns[this.focusI]) this.btns[this.focusI].focus({ preventScroll: true }); }, 0);
    },
    // the scene, built and its shaders compiled before it is seen
    makeScene() {
      const g = G.Game;
      if (!g || !g.renderer || !G.MenuScene || this.held) return;
      const t0 = performance.now();
      this.quality = G.save.settings.graphicsQuality;
      this.scene = G.MenuScene.build(this.quality);
      this.scene.fit(window.innerWidth, window.innerHeight);
      this.withLook(() => {
        const r = g.renderer;
        if (!this.postOn()) { r.compile(this.scene.scene, this.scene.camera); return; }
        // (High and up: as it is drawn -- linear, into the target -- and the pass after)
        const P = this.postFit(), tm = r.toneMapping;
        r.toneMapping = THREE.NoToneMapping; r.setRenderTarget(P.rt);
        try { r.compile(this.scene.scene, this.scene.camera); } finally { r.setRenderTarget(null); r.toneMapping = tm; }
        r.compile(P.scene, P.cam);
      });
      this.buildMs = performance.now() - t0;
    },
    // a level starting (js/game.js beginRun): the facility falls silent, the
    // High pass lets its target go; the scene waits, undrawn, for the way back
    pause() { this.ambience(false); this.postTarget(); },
    // let the scene go -- its geometry and textures freed (the Zombie Gallery,
    // a new graphics tier); built again when next in view
    dispose() {
      this.ambience(false);
      this.postFree();
      if (!this.scene) return;
      this.scene.dispose();
      this.scene = null;
    },
    visible() { return this.built && !this.held && G.UI._currentScreen === "screen-home"; },
    // a page opened from here, over the scene
    over() { return this.built && !this.held && G.UI.menuOrigin === "home" && G.UI._currentScreen !== "screen-home" && G.UI._currentScreen !== "screen-mainmenu" && G.Game && G.Game.state === "MENU"; },

    // another language (js/ui.js languageChanged): its words written again
    relabel() {
      if (!this.built) return;
      const root = $("screen-home");
      $("home-menu").setAttribute("aria-label", T("home.menu"));
      root.querySelectorAll(".hm-group").forEach((g) => { g.querySelector(".hm-head").textContent = T("home.group." + g.dataset.group); });
      this.btns.forEach((b) => { b.querySelector(".hm-label").textContent = T("home.item." + b.dataset.item); });
      root.querySelector(".hs-text").textContent = T("home.sound");
      $("home-signin").textContent = T("account.signIn");
      root.querySelector(".home-rotate").textContent = T("home.rotate");
      this.refresh();
    },
    // the player and the version; the words due today
    refresh() {
      const a = G.Account ? G.Account.state() : { signedIn: false };
      $("home-name").textContent = a.signedIn ? a.name : T("account.guest");
      $("home-signin").classList.toggle("hidden", !!a.signedIn || !G.Account);
      const due = G.SRS && G.SRS.dueToday ? G.SRS.dueToday().length : 0, b = $("home-due");
      if (b) { b.textContent = due > 99 ? "99+" : String(due); b.classList.toggle("hidden", !due); }
      if (G.Updater) { G.Updater.showLabel(); G.Updater.badge(); }
    },
    // the first gesture: sound on, the music and the facility fade in
    wake(quiet) {
      if (!quiet) G.Audio.unlock();
      const A = G.Audio, on = !!(A.ctx && A.ctx.state === "running");
      $("home-sound").classList.toggle("gone", on);
      if (!on) { if (!quiet) setTimeout(() => this.wake(true), 120); return; }
      if (A.menuMusic && !A._menu) A.menuMusic(true);
      this.ambience(true);
    },

    // ---------------- the menu's own keys and buttons ----------------
    mark() { this.btns.forEach((b, i) => b.classList.toggle("pad-focus", i === this.focusI && G.Input.mode !== "touch")); },
    hover(i) {
      if (this._hoverI === i) return;
      this._hoverI = i;
      if (G.Audio.ctx) G.Audio.sfx("ui_hover");
    },
    move(d) {
      const n = this.btns.length;
      this.focusI = (this.focusI + d + n) % n;
      this._hoverI = null; this.hover(this.focusI);
      this.btns[this.focusI].focus({ preventScroll: true });
      this.mark();
    },
    onKey(e) {
      if (!this.visible() || (G.Modal && G.Modal.isOpen())) return false;
      this.wake();
      const k = e.code;
      if (k === "ArrowDown" || k === "KeyS") { this.move(1); e.preventDefault && e.preventDefault(); return true; }
      if (k === "ArrowUp" || k === "KeyW") { this.move(-1); e.preventDefault && e.preventDefault(); return true; }
      if (k === "Enter" || k === "Space" || k === "NumpadEnter") { e.preventDefault && e.preventDefault(); this.activate(this.items()[this.focusI]); return true; }
      if (k === "Escape") { this.focusI = 0; this.mark(); this.btns[0].focus({ preventScroll: true }); return true; }
      return false;
    },
    // a controller, from G.Pad.navigate while the menu is on screen
    pad(gp, now, edge, dt) {
      const B = G.Pad.B, ay = gp.axes[1] || 0;
      let dir = 0;
      if (now[B.UP] || ay < -0.6) dir = -1; else if (now[B.DOWN] || ay > 0.6) dir = 1;
      if (dir !== this._padDir) { this._padDir = dir; this._padT = 0; if (dir) { this.wake(); this.move(dir); } }
      else if (dir) { this._padT += dt; if (this._padT > 0.34) { this._padT = 0.2; this.move(dir); } }
      if (edge(B.A)) { this.wake(); this.activate(this.items()[this.focusI]); }
    },
    // a button pressed: PLAY to the lobby, the rest to their own pages
    activate(id) {
      const UI = G.UI, H = "screen-home";
      G.Audio.unlock();
      this.wake();
      if (id === "play") {
        if (G.Audio.ctx) G.Audio.sfx("ui_select");
        this.toLobby();
        return;
      }
      if (G.Audio.ctx) G.Audio.sfx("ui_open");
      UI.menuOrigin = "home";
      document.body.classList.add("over-home");
      if (id === "review") { G.Study.openDaily(); return; }
      if (id === "progress") G.Progress.open();
      else if (id === "vocab") { UI._logReturnScreen = H; UI.renderVocabLog(1); UI.showScreen("screen-vocablog"); }
      else if (id === "notes") UI.openJournal(H);
      else if (id === "custom") G.CustomVocabUI.open(H);
      else if (id === "weapons") { UI._logReturnScreen = H; UI.renderWeaponLog(1); UI.showScreen("screen-weaponlog"); }
      else if (id === "bosses") UI.openCodex(H);
      else if (id === "ranks") { UI.renderLeaderboard("level1"); UI.showScreen("screen-leaderboard"); }
      else if (id === "awards") { UI.renderAchievements(); UI.showScreen("screen-achievements"); }
      else if (id === "settings") { UI._settingsReturn = H; UI.renderSettings(); UI.showScreen("screen-settings"); }
      else if (id === "help") UI.showScreen("screen-howtoplay");
    },
    // PLAY: the lobby (its Back comes here); the first time, how bright the night should be
    toLobby() {
      G.UI.menuOrigin = "lobby";
      document.body.classList.remove("over-home");
      G.UI.goToMainMenu({ lobby: true });
      if (G.Updater) { G.Updater.badge(); if (G.Updater._offerLater) G.Updater.offer(G.Updater._offerM); }
      if (G.BrightnessCal && G.save && !G.save.settings.brightnessSet && !G.Modal.isOpen()) G.BrightnessCal.open("start");
    },
    // the lobby's Back, Esc or B
    back() {
      if (G.Audio.ctx) G.Audio.sfx("ui_back");
      this.show();
    },

    // ---------------- every frame (js/game.js loop, in the menus) ----------------
    frame(dt) {
      const g = G.Game;
      if (!g || !g.renderer || g.state !== "MENU" || document.hidden) return;
      const vis = this.visible(), over = this.over();
      if (!vis && !over) { if (this._amb) this.ambience(false); return; }
      // (another graphics tier chosen in Settings: the scene built again for it; its sounds play on)
      if (this.scene && this.quality !== G.save.settings.graphicsQuality) { this.scene.dispose(); this.scene = null; if (!this.postOn()) this.postFree(); }
      if (!this.scene) this.makeScene();
      if (!this.scene) return;
      // (a page over it: a third of the frames -- the scene still moves)
      this._frame++;
      this._t += dt;
      this._acc = (this._acc || 0) + dt;
      if (over && this._frame % 3) return;
      const step = Math.min(0.1, this._acc); this._acc = 0;
      const motion = !(G.save && G.save.settings.reduceMotion);
      this.scene.update(step, this._t, motion);
      if (G.Audio.ctx) { G.Audio.updateListener(this.scene.camera); this.ambienceTick(step); }
      this.withLook(() => {
        const r = g.renderer;
        r.info.reset();
        r.autoClear = true;
        if (this.postOn()) { this.renderPost(r); return; }
        r.setRenderTarget(null);
        r.render(this.scene.scene, this.scene.camera);
      });
    },

    // ---------------- High and up: a little depth of field, and SSAO ----------------
    // (5.5, 5.11) The scene drawn linear into a half-float target with its
    // depth; then one pass: the far end of the corridor a little soft (the
    // survivor and all that is near stay sharp), corners and contacts darker
    // from the depth alone (over the baked AO), then the same filmic curve and
    // sRGB as the plain path. WebGL 2 with a half-float target to draw into
    // (G.Visuals.hdr) and depth textures.
    postOn() { return /high/.test(G.save.settings.graphicsQuality) && G.Game.renderer.capabilities.isWebGL2 && !!(G.Visuals && G.Visuals.hdr && G.Visuals.depthOK); },
    postFit() {
      const v = G.Game.renderer.getDrawingBufferSize(new THREE.Vector2());
      let P = this.post;
      if (!P) {
        const mat = new THREE.ShaderMaterial({
          uniforms: { tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uCam: { value: new THREE.Vector2() },
            uTan: { value: 0.4 }, uFocus: { value: 4 }, uBlur: { value: 2 }, uAO: { value: 0.5 }, uExposure: { value: 1 } },
          vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false, toneMapped: false,
        });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
        quad.frustumCulled = false;
        const scene = new THREE.Scene();
        scene.add(quad);
        P = this.post = { rt: null, mat, scene, cam: new THREE.Camera() };
      }
      if (P.rt && (P.rt.width !== v.x || P.rt.height !== v.y)) this.postTarget();
      if (!P.rt) {
        const rt = new THREE.WebGLRenderTarget(v.x, v.y, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false });
        rt.texture.generateMipmaps = false;
        rt.depthTexture = new THREE.DepthTexture(v.x, v.y, THREE.UnsignedIntType);
        rt.depthTexture.format = THREE.DepthFormat;
        P.rt = rt;
      }
      return P;
    },
    // the target let go (a level starting, a new size): the size of the
    // screen in half floats and depth -- some 25 MB at 1080p
    postTarget() {
      const P = this.post;
      if (!P || !P.rt) return;
      P.rt.depthTexture.dispose(); P.rt.dispose();
      P.rt = null;
    },
    postFree() {
      const P = this.post;
      if (!P) return;
      this.postTarget();
      P.mat.dispose(); P.scene.children[0].geometry.dispose();
      this.post = null;
    },
    renderPost(r) {
      const P = this.postFit(), S = this.scene, cam = S.camera, U = P.mat.uniforms, tm = r.toneMapping;
      r.toneMapping = THREE.NoToneMapping;
      r.setRenderTarget(P.rt);
      try { r.render(S.scene, cam); } finally { r.setRenderTarget(null); r.toneMapping = tm; }
      U.tColor.value = P.rt.texture; U.tDepth.value = P.rt.depthTexture;
      U.uRes.value.set(P.rt.width, P.rt.height); U.uCam.value.set(cam.near, cam.far);
      U.uTan.value = Math.tan(cam.fov * Math.PI / 360);
      U.uFocus.value = cam.position.distanceTo(S.survivor.root.position);
      U.uBlur.value = 2.6 * P.rt.height / 1080;
      U.uAO.value = G.save.settings.graphicsQuality === "vhigh" ? 0.6 : 0.5;
      U.uExposure.value = r.toneMappingExposure;
      r.render(P.scene, P.cam);
    },
    // the menu's own look: filmic, sRGB (the game's frame does its own in js/visuals.js)
    withLook(fn) {
      const r = G.Game.renderer, tm = r.toneMapping, enc = r.outputEncoding, ex = r.toneMappingExposure, sh = r.shadowMap.enabled;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.outputEncoding = THREE.sRGBEncoding; r.toneMappingExposure = 1.15;
      r.shadowMap.enabled = /high/.test(G.save.settings.graphicsQuality);
      try { fn(); } finally { r.toneMapping = tm; r.outputEncoding = enc; r.toneMappingExposure = ex; r.shadowMap.enabled = sh; }
    },

    // ---------------- the facility's sounds ----------------
    ambience(on) {
      const A = G.Audio, ctx = A.ctx;
      if (!on) {
        const S = this._amb;
        this._amb = null;
        if (!S || !ctx) return;
        const t = ctx.currentTime;
        S.out.gain.setTargetAtTime(0.0001, t, 0.5);
        S.nodes.forEach((n) => { try { n.stop(t + 2); } catch (e) { /* stopped */ } });
        return;
      }
      if (this._amb || !ctx || !this.scene || A._level) return;
      const C = G.CONFIG.menuMusic, t = ctx.currentTime, P = this.scene.sounds;
      const S = { nodes: [], next: t + 3 + Math.random() * 4 };
      S.out = ctx.createGain(); S.out.gain.setValueAtTime(0.0001, t); S.out.gain.setTargetAtTime(C.ambience, t, 1.8);
      S.out.connect(A.bus.ambient);
      if (A.revIn) { const sg = ctx.createGain(); sg.gain.value = 0.35; S.out.connect(sg); sg.connect(A.revIn); }
      // (the underground's reverb, as the game's own)
      if (G.Acoustics) G.Acoustics.setZone("underground");
      const placed = (pos, ref) => {
        const p = ctx.createPanner(); p.panningModel = "equalpower"; p.distanceModel = "inverse"; p.refDistance = ref || 3; p.rolloffFactor = 1.1;
        if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
        p.connect(S.out); return p;
      };
      const loopNoise = (dest, type, f, q, g, rate) => {
        const s = ctx.createBufferSource(); s.buffer = A.noiseBuffer(); s.loop = true; s.playbackRate.value = rate || 1;
        const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        const gg = ctx.createGain(); gg.gain.value = g;
        s.connect(fl); fl.connect(gg); gg.connect(dest); s.start(); S.nodes.push(s);
        return { fl, gg };
      };
      const hum = (dest, f, g) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.frequency.value = f; gg.gain.value = g; o.connect(gg); gg.connect(dest); o.start(); S.nodes.push(o); return gg; };
      // the fan in the wall: a whirr and its motor
      const fan = placed(P.fan, 2.5);
      loopNoise(fan, "bandpass", 260, 1.2, 0.18);
      hum(fan, 58, 0.03);
      // the panels' electrical hum
      const panel = placed(P.panel, 1.5);
      hum(panel, 100, 0.012); hum(panel, 200, 0.006);
      // machinery behind the door: a slow low rumble
      const door = placed(P.door, 6);
      const rum = loopNoise(door, "lowpass", 110, 0.7, 0.4, 0.6);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.18; lfo.connect(lg); lg.connect(rum.gg.gain); lfo.start(); S.nodes.push(lfo);
      // the wind down the corridor (all round)
      const wind = loopNoise(S.out, "bandpass", 380, 0.6, 0.05, 0.5);
      const wl = ctx.createOscillator(), wg = ctx.createGain(); wl.frequency.value = 0.05; wg.gain.value = 160; wl.connect(wg); wg.connect(wind.fl.frequency); wl.start(); S.nodes.push(wl);
      this._amb = S;
    },
    // now and then, from somewhere real: metal settling, a knock in the dark,
    // a tick in the pipes, the survivor's gear (very quiet)
    ambienceTick() {
      const S = this._amb, A = G.Audio;
      if (!S || !A.ctx || !this.scene) return;
      const now = A.ctx.currentTime, P = this.scene.sounds;
      if (now < S.next) return;
      const r = Math.random(), at = (v) => v.clone();
      if (r < 0.3) A.tone({ type: "sawtooth", freq: 70 + Math.random() * 30, freqEnd: 48, dur: 1.4, gain: 0.05, bus: "ambient", filter: { type: "bandpass", freq: 420, q: 6 }, pos: at(P.pipes), rev: 0.6 });
      else if (r < 0.55) { for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) A.noise({ dur: 0.07, filter: "lowpass", freq: 520, gain: 0.12, at: i * (0.35 + Math.random() * 0.2), bus: "ambient", pos: at(P.dark), rev: 0.8 }); }
      else if (r < 0.8) A.tone({ type: "triangle", freq: 1900 + Math.random() * 600, dur: 0.05, gain: 0.025, bus: "ambient", pos: at(P.pipes) });
      else A.noise({ dur: 0.35, filter: "bandpass", freq: 1300, q: 0.8, gain: 0.02, attack: 0.12, bus: "ambient", pos: at(P.survivor) });
      S.next = now + 4 + Math.random() * 9;
    },
  };
})();
