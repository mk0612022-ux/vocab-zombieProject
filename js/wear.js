// ===================================================================
// Wear and tear (newer list, round 3, I3)
// -------------------------------------------------------------------
// Years empty, and a bad night at the end of them. On the walls, inside and
// out: black scuffs where bags and shoulders rubbed along the corridors,
// scrapes, claw marks, cracks and knocked-off plaster, water stains running
// down from the ceiling, mould in the corners, chipped paint, soot -- and the
// blood: hands pressed to a wall and dragged down it, splashes, smears, a
// pool on the floor, the trail of something pulled away. Messages from the
// last people here, in red paint and black marker on the walls (in chalk on
// the boards: js/schoolrooms.js). Locker doors hanging off their hinges,
// cables hanging out of the ceiling where a tile came down, light fittings
// fallen at one end, the room signs over the doors hanging askew.
//
// All the marks are flat decals cut from ONE texture atlas (the writing from
// a second), so the level's merge (G.Perf.mergeStatic) bakes a room's worth
// into a draw call or two. Each is in a tier -- A: always, B: from Medium,
// C: from High -- and the tiers have their own (otherwise identical)
// material, so they merge apart and G.SchoolWear.applyQuality turns them on
// and off live. The things that stick out (doors, cables, fittings) are
// plain boxes in the dressing palette and merge with everything else.
// Nothing here is a collider: no route, shot or "press E" changes.
// ===================================================================
(function () {
  const RANK = { vlow: 0, low: 1, medium: 2, high: 3, vhigh: 4 };
  const TIER = { A: 0, B: 2, C: 3 };           // the lowest quality rank that draws it
  const CELLS = {
    scuff: 0, scrape: 1, claw: 2, crack: 3, plaster: 4, water: 5, mould: 6, hand: 7,
    handsDown: 8, splash: 9, smear: 10, pool: 11, drag: 12, paint: 13, soot: 14, tally: 15,
  };

  // three materials alike but for a hair of colour: the merge keys on colour,
  // so each tier stays its own mesh and can be switched off with the quality
  function tiered(tex) {
    const mk = (color) => new THREE.MeshLambertMaterial({
      map: tex, color, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    });
    return { A: mk(0xffffff), B: mk(0xfefefe), C: mk(0xfdfdfd) };
  }

  // ---- the marks: 4 x 4 cells of 256 px -----------------------------------
  let marks = null;
  function markAtlas() {
    if (marks) return marks;
    const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S * 4;
    const c = cv.getContext("2d"), R = G.makeRng(6161);
    const cell = (i) => [(i % 4) * S, Math.floor(i / 4) * S];
    const blob = (x, y, rx, ry, rgb, a, soft) => {
      const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(soft == null ? 0.6 : soft, `rgba(${rgb},${a * 0.8})`); g.addColorStop(1, `rgba(${rgb},0)`);
      c.save(); c.translate(x, y); c.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); c.translate(-x, -y);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, Math.max(rx, ry), 0, 7); c.fill(); c.restore();
    };
    const line = (pts, w, style) => { c.strokeStyle = style; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
    const smear = (x, y, len, th, ang, rgb, a) => {
      c.save(); c.translate(x, y); c.rotate(ang);
      const g = c.createLinearGradient(-len / 2, 0, len / 2, 0);
      g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.2, `rgba(${rgb},${a})`); g.addColorStop(0.75, `rgba(${rgb},${a * 0.8})`); g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      for (let k = 0; k < 3; k++) { c.globalAlpha = 0.45 + k * 0.25; c.fillRect(-len / 2, -th / 2 + k * th / 6, len, th - k * th / 3); }
      c.restore(); c.globalAlpha = 1;
    };
    const drips = (x0, x1, y, n, rgb, a, maxLen) => {
      for (let k = 0; k < n; k++) {
        const x = x0 + R() * (x1 - x0), len = 10 + R() * maxLen, w = 2 + R() * 3.5;
        c.fillStyle = `rgba(${rgb},${a})`; c.fillRect(x - w / 2, y, w, len);
        c.beginPath(); c.arc(x, y + len, w * 0.8, 0, 7); c.fill();
      }
    };
    const crack = (x, y, ang, len, w, depth) => {
      let px = x, py = y;
      const pts = [[px, py]];
      const steps = Math.max(2, Math.round(len / 9));
      for (let k = 0; k < steps; k++) { ang += (R() - 0.5) * 0.7; px += Math.cos(ang) * len / steps; py += Math.sin(ang) * len / steps; pts.push([px, py]); }
      line(pts.map(([a, b]) => [a + 1, b + 1]), w + 0.6, "rgba(235,230,215,0.35)");
      line(pts, w, "rgba(24,21,18,0.85)");
      if (depth > 0) for (let k = 0; k < 2; k++) if (R() < 0.75) { const [bx, by] = pts[1 + Math.floor(R() * (pts.length - 1))]; crack(bx, by, ang + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.7), len * (0.35 + R() * 0.3), Math.max(0.8, w * 0.6), depth - 1); }
    };
    const BLOOD = "112,10,8", DRIED = "70,8,6";
    const hand = (x, y, s, ang, rgb, a) => {
      c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
      c.fillStyle = `rgba(${rgb},${a})`;
      c.beginPath(); c.ellipse(0, 10, 17, 21, 0, 0, 7); c.fill();                        // palm
      [[-13, -18, 5.5, 17, -0.18], [-4.5, -24, 5.8, 20, -0.05], [4.5, -23, 5.6, 19, 0.06], [12.5, -16, 5, 15, 0.2]].forEach(([fx, fy, rw, rh, r]) => {
        c.save(); c.translate(fx, fy); c.rotate(r); c.beginPath(); c.ellipse(0, 0, rw, rh, 0, 0, 7); c.fill(); c.restore();
      });
      c.save(); c.translate(-19, 12); c.rotate(-0.9); c.beginPath(); c.ellipse(0, 0, 6, 15, 0, 0, 7); c.fill(); c.restore();   // thumb
      // (paler where the hand pressed hardest: it wipes the wall clean)
      c.globalCompositeOperation = "destination-out"; c.fillStyle = "rgba(0,0,0,0.35)";
      for (let k = 0; k < 6; k++) { c.beginPath(); c.arc((R() - 0.5) * 22, 8 + (R() - 0.5) * 26, 2 + R() * 4, 0, 7); c.fill(); }
      c.restore(); c.globalCompositeOperation = "source-over";
    };
    const draw = {
      scuff(x, y) {
        for (let k = 0; k < 9; k++) smear(x + 40 + R() * 176, y + 90 + R() * 90, 40 + R() * 110, 5 + R() * 14, (R() - 0.5) * 0.25, R() < 0.7 ? "22,20,18" : "60,54,46", 0.25 + R() * 0.35);
      },
      scrape(x, y) {
        for (let k = 0; k < 28; k++) {
          const x0 = x + 30 + R() * 190, y0 = y + 40 + R() * 170, len = 20 + R() * 60, a = -0.3 + (R() - 0.5) * 0.5;
          line([[x0, y0], [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len]], 1 + R() * 1.6, R() < 0.6 ? "rgba(236,232,220,0.55)" : "rgba(40,36,30,0.5)");
        }
      },
      claw(x, y) {
        const a = 1.15 + (R() - 0.5) * 0.3;
        for (let k = 0; k < 4; k++) {
          const x0 = x + 70 + k * 26, y0 = y + 30 + k * 6, len = 170 - Math.abs(k - 1.5) * 18;
          const pts = []; for (let t = 0; t <= 1.001; t += 0.1) pts.push([x0 + Math.cos(a) * len * t + Math.sin(t * 3) * 6, y0 + Math.sin(a) * len * t]);
          line(pts.map(([p, q]) => [p + 2.5, q]), 6, "rgba(232,226,210,0.6)");
          line(pts, 5, "rgba(38,28,22,0.85)");
          line(pts.slice(0, 7), 2.5, "rgba(15,10,8,0.9)");
        }
      },
      crack(x, y) { crack(x + 128, y + 30, Math.PI / 2 + (R() - 0.5) * 0.6, 200, 2.4, 3); },
      plaster(x, y) {
        const cx = x + 128, cy = y + 128, pts = [];
        for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2, r = 45 + R() * 45; pts.push([cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 0.8]); }
        c.fillStyle = "rgba(122,92,72,0.95)"; c.beginPath(); pts.forEach(([p, q], i) => (i ? c.lineTo(p, q) : c.moveTo(p, q))); c.closePath(); c.fill();
        c.save(); c.clip();
        c.strokeStyle = "rgba(200,190,170,0.55)"; c.lineWidth = 3;
        for (let r = 0; r < 8; r++) { const yy = cy - 90 + r * 22; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + S, yy); c.stroke(); for (let b = 0; b < 6; b++) { const xx = x + ((b * 52 + (r % 2) * 26) % S); c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 22); c.stroke(); } }
        c.restore();
        line(pts.concat([pts[0]]), 3, "rgba(230,225,210,0.7)");
        for (let k = 0; k < 3; k++) crack(pts[k * 3][0], pts[k * 3][1], Math.atan2(pts[k * 3][1] - cy, pts[k * 3][0] - cx), 50 + R() * 40, 1.6, 1);
      },
      water(x, y) {
        for (let k = 0; k < 4; k++) {
          const w = 150 - k * 28, h = 60 - k * 10;
          blob(x + 128 + (R() - 0.5) * 20, y + 40 + k * 6, w / 2, h / 2, "120,92,52", 0.22, 0.85);
          c.strokeStyle = "rgba(96,70,36,0.45)"; c.lineWidth = 2; c.beginPath(); c.ellipse(x + 128, y + 40 + k * 6, w / 2 - 4, h / 2 - 4, 0, 0, 7); c.stroke();
        }
        for (let k = 0; k < 7; k++) {
          const xx = x + 60 + R() * 136, len = 60 + R() * 140, w = 6 + R() * 14;
          const g = c.createLinearGradient(0, y + 50, 0, y + 50 + len);
          g.addColorStop(0, "rgba(110,84,48,0.38)"); g.addColorStop(1, "rgba(110,84,48,0)");
          c.fillStyle = g; c.fillRect(xx - w / 2, y + 50, w, len);
        }
      },
      mould(x, y) {
        for (let k = 0; k < 26; k++) blob(x + 128 + (R() - 0.5) * 170, y + 150 + (R() - 0.4) * 150 * R(), 8 + R() * 34, 6 + R() * 26, R() < 0.5 ? "28,36,22" : "46,52,30", 0.35 + R() * 0.35);
        for (let k = 0; k < 120; k++) { c.fillStyle = "rgba(20,26,16,0.6)"; const d = 1 + R() * 2.5; c.fillRect(x + 40 + R() * 176, y + 60 + R() * 180, d, d); }
      },
      hand(x, y) {
        hand(x + 128, y + 110, 2.6, (R() - 0.5) * 0.4, BLOOD, 0.85);
        drips(x + 90, x + 170, y + 150, 5, BLOOD, 0.75, 70);
      },
      handsDown(x, y) {
        [[x + 84, -0.15], [x + 172, 0.2]].forEach(([hx, a]) => {
          // the print at the top, then the fingers dragged down the wall
          hand(hx, y + 52, 1.35, a, BLOOD, 0.9);
          for (let k = 0; k < 4; k++) {
            const fx = hx - 16 + k * 10 + a * 20, len = 120 + R() * 70;
            const g = c.createLinearGradient(0, y + 40, 0, y + 40 + len);
            g.addColorStop(0, `rgba(${BLOOD},0.8)`); g.addColorStop(1, `rgba(${BLOOD},0)`);
            c.fillStyle = g; c.fillRect(fx - 3.5, y + 40, 7, len);
          }
        });
      },
      splash(x, y) {
        blob(x + 128, y + 118, 40, 34, BLOOD, 0.85, 0.75);
        for (let k = 0; k < 34; k++) {
          const a = R() * Math.PI * 2, r = 40 + R() * 80, s = 2 + R() * 7;
          c.fillStyle = `rgba(${BLOOD},${0.6 + R() * 0.3})`; c.beginPath(); c.arc(x + 128 + Math.cos(a) * r, y + 118 + Math.sin(a) * r * 0.8, s, 0, 7); c.fill();
          if (R() < 0.3) line([[x + 128 + Math.cos(a) * 40, y + 118 + Math.sin(a) * 32], [x + 128 + Math.cos(a) * r, y + 118 + Math.sin(a) * r * 0.8]], s * 0.6, `rgba(${BLOOD},0.6)`);
        }
        drips(x + 100, x + 160, y + 140, 4, BLOOD, 0.7, 80);
      },
      smear(x, y) {
        for (let k = 0; k < 5; k++) smear(x + 128, y + 100 + k * 12 + (R() - 0.5) * 8, 200 - k * 16, 10 + R() * 10, (R() - 0.5) * 0.12, k % 2 ? DRIED : BLOOD, 0.55 + R() * 0.3);
        hand(x + 40, y + 108, 1.1, -1.4, BLOOD, 0.85);
        drips(x + 60, x + 200, y + 130, 5, BLOOD, 0.6, 50);
      },
      pool(x, y) {
        const pts = []; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, r = 70 + R() * 40; pts.push([x + 128 + Math.cos(a) * r, y + 128 + Math.sin(a) * r * 0.85]); }
        c.fillStyle = `rgba(${DRIED},0.92)`; c.beginPath(); pts.forEach(([p, q], i) => (i ? c.lineTo(p, q) : c.moveTo(p, q))); c.closePath(); c.fill();
        blob(x + 128, y + 128, 60, 50, BLOOD, 0.7, 0.8);
        c.fillStyle = "rgba(255,255,255,0.12)"; c.beginPath(); c.ellipse(x + 110, y + 110, 26, 10, -0.4, 0, 7); c.fill();   // the wet shine
        for (let k = 0; k < 16; k++) { const a = R() * 7, r = 105 + R() * 25; c.fillStyle = `rgba(${DRIED},0.8)`; c.beginPath(); c.arc(x + 128 + Math.cos(a) * r, y + 128 + Math.sin(a) * r * 0.85, 2 + R() * 4, 0, 7); c.fill(); }
      },
      drag(x, y) {
        // the trail of something dragged (along the cell's length)
        for (let k = 0; k < 6; k++) smear(x + 128, y + 128 + (k - 2.5) * 11 + (R() - 0.5) * 6, 250, 8 + R() * 10, (R() - 0.5) * 0.06, k % 2 ? DRIED : BLOOD, 0.45 + R() * 0.35);
        for (let k = 0; k < 20; k++) { c.fillStyle = `rgba(${BLOOD},0.7)`; c.beginPath(); c.arc(x + 10 + R() * 236, y + 128 + (R() - 0.5) * 90, 1.5 + R() * 3.5, 0, 7); c.fill(); }
      },
      paint(x, y) {
        // paint lifting off in curls: the old coat under it a little darker,
        // a pale lifted edge on top, a thin shadow under
        for (let k = 0; k < 7; k++) {
          const cx = x + 50 + R() * 156, cy = y + 50 + R() * 156, pts = [];
          for (let j = 0; j < 9; j++) { const a = j / 9 * Math.PI * 2, r = (12 + R() * 26) * (j % 2 ? 0.6 : 1); pts.push([cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 0.8]); }
          const path = () => { c.beginPath(); pts.forEach(([p, q], i) => (i ? c.lineTo(p, q) : c.moveTo(p, q))); c.closePath(); };
          c.save(); c.translate(1.5, 2.5); c.fillStyle = "rgba(40,36,30,0.28)"; path(); c.fill(); c.restore();
          c.fillStyle = "rgba(128,122,108,0.42)"; path(); c.fill();
          c.strokeStyle = "rgba(245,242,232,0.55)"; c.lineWidth = 2; c.beginPath(); pts.slice(0, 5).forEach(([p, q], i) => (i ? c.lineTo(p, q) : c.moveTo(p, q))); c.stroke();
        }
      },
      soot(x, y) {
        for (let k = 0; k < 8; k++) blob(x + 128 + (R() - 0.5) * 50, y + 210 - k * 22, 60 - k * 5, 40 + k * 3, "18,16,14", 0.28 + R() * 0.1, 0.4);
      },
      tally(x, y) {
        c.strokeStyle = "rgba(28,26,24,0.85)"; c.lineWidth = 5; c.lineCap = "round";
        for (let gi = 0; gi < 4; gi++) {
          const gx = x + 22 + (gi % 2) * 116, gy = y + 40 + Math.floor(gi / 2) * 100, n = gi === 3 ? 2 + Math.floor(R() * 3) : 5;
          for (let k = 0; k < Math.min(4, n); k++) { c.beginPath(); c.moveTo(gx + k * 20 + (R() - 0.5) * 4, gy); c.lineTo(gx + k * 20 + (R() - 0.5) * 6, gy + 64); c.stroke(); }
          if (n === 5) { c.beginPath(); c.moveTo(gx - 8, gy + 54); c.lineTo(gx + 76, gy + 10); c.stroke(); }
        }
      },
    };
    Object.keys(CELLS).forEach((k) => { const [x, y] = cell(CELLS[k]); c.save(); c.beginPath(); c.rect(x + 3, y + 3, S - 6, S - 6); c.clip(); draw[k](x, y); c.restore(); });
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    marks = { tex, mats: tiered(tex) };
    return marks;
  }

  // ---- the writing: 2 x 8 cells of 512 x 128 -------------------------------
  // 1-6 chalk (the boards), 7-11 red paint, 12-14 black marker ("scrawl.N" in
  // js/strings.js)
  let words = null;
  const HOW = (n) => (n <= 6 ? "chalk" : n <= 11 ? "paint" : "marker");
  function wordAtlas() {
    if (words) return words;
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 1024;
    const c = cv.getContext("2d"), R = G.makeRng(1717);
    for (let n = 1; n <= 14; n++) {
      const i = n - 1, x = (i % 2) * 512, y = Math.floor(i / 2) * 128, how = HOW(n), text = G.T("scrawl." + n);
      c.save(); c.beginPath(); c.rect(x, y, 512, 128); c.clip();
      c.translate(x + 256, y + 66); c.rotate((R() - 0.5) * 0.08);
      c.textAlign = "center"; c.textBaseline = "middle";
      const font = how === "chalk" ? "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive" : "Impact, 'Arial Black', sans-serif";
      G.fitFont(c, text, how === "chalk" ? 74 : 76, 490, font);
      if (how === "chalk") {
        c.fillStyle = "rgba(240,242,234,0.95)"; c.fillText(text, 0, 0);
        c.globalCompositeOperation = "destination-out";
        for (let k = 0; k < 450; k++) { c.fillStyle = `rgba(0,0,0,${(0.3 + R() * 0.6).toFixed(2)})`; c.fillRect(-250 + R() * 500, -50 + R() * 100, 1 + R() * 2, 1 + R() * 2); }
      } else {
        const col = how === "paint" ? "150,14,10" : "22,20,20";
        c.fillStyle = `rgba(${col},0.92)`; c.fillText(text, 0, 0);
        if (how === "paint") {
          // it ran before it dried
          const w = Math.min(480, c.measureText(text).width);
          for (let k = 0; k < 9; k++) { const dx = -w / 2 + R() * w, len = 12 + R() * 30, dw = 2 + R() * 3; c.fillRect(dx - dw / 2, 18, dw, len); c.beginPath(); c.arc(dx, 18 + len, dw * 0.8, 0, 7); c.fill(); }
        }
      }
      c.restore();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    words = { tex, mats: tiered(tex) };
    return words;
  }

  // a flat piece of an atlas, `cols` x `rows` cells, facing +z
  function cut(A, i, cols, rows, w, h, tier) {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    const u0 = (i % cols) / cols, v0 = 1 - (Math.floor(i / cols) + 1) / rows;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / cols, v0 + uv.getY(k) / rows);
    return new THREE.Mesh(g, A.mats[tier || "A"]);
  }
  const mark = (kind, w, h, tier) => cut(markAtlas(), CELLS[kind], 4, 4, w, h, tier);
  const scrawl = (n, w, h, tier) => cut(wordAtlas(), n - 1, 2, 8, w, h, tier);

  // what a wall run gets, and how much of it: [kind, weight, y range, width
  // range, height/width, tier]. (y is from the floor; nothing crosses the
  // dado rail at 1.12-1.18 m, which stands proud of the wall.)
  const LOW = [0.15, 1.08], HIGH = [1.24, 3.3];
  const KINDS = [
    ["scuff", 5, LOW, [0.9, 1.7], 0.45, "B"],
    ["scrape", 2, LOW, [0.6, 1.1], 0.8, "C"],
    ["scrape", 1, HIGH, [0.6, 1.1], 0.8, "C"],
    ["claw", 2, HIGH, [0.55, 0.9], 1.0, "B"],
    ["claw", 1, LOW, [0.5, 0.75], 1.0, "B"],
    ["crack", 3, HIGH, [0.8, 1.6], 1.0, "A"],
    ["plaster", 1.5, HIGH, [0.6, 1.0], 1.0, "B"],
    ["water", 2.5, [2.3, 3.35], [0.9, 1.6], 0.9, "A"],
    ["mould", 1.5, LOW, [0.5, 0.9], 1.0, "B"],
    ["mould", 1, [2.6, 3.35], [0.6, 1.0], 1.0, "B"],
    ["hand", 2.5, HIGH, [0.28, 0.4], 1.0, "A"],
    ["hand", 1, LOW, [0.26, 0.36], 1.0, "A"],
    ["handsDown", 2, [1.24, 2.4], [0.7, 0.9], 1.0, "A"],
    ["splash", 1.5, HIGH, [0.6, 1.0], 1.0, "B"],
    ["smear", 1.5, HIGH, [0.9, 1.4], 0.9, "A"],
    ["paint", 1.5, HIGH, [0.6, 1.0], 1.0, "C"],
    ["soot", 0.5, [1.6, 3.2], [0.8, 1.2], 1.4, "C"],
    ["tally", 0.6, HIGH, [0.45, 0.6], 1.0, "C"],
  ];
  // outside: the weather and a little of the night
  const OUT = [
    ["crack", 4, [1.2, 11], [1.0, 2.2], 1.0, "A"],
    ["plaster", 2, [1.0, 11], [0.8, 1.4], 1.0, "B"],
    ["water", 3, [1.5, 11], [1.2, 2.2], 1.1, "A"],
    ["mould", 3, [0.75, 1.6], [0.8, 1.6], 0.8, "B"],
    ["paint", 2, [1.0, 11], [0.8, 1.4], 1.0, "C"],
    ["scrape", 1.5, [0.8, 2.0], [0.8, 1.3], 0.8, "C"],
    ["soot", 0.8, [1.0, 11], [1.0, 1.6], 1.4, "C"],
    ["claw", 1, [0.9, 2.1], [0.6, 0.9], 1.0, "B"],
    ["hand", 1, [0.9, 1.9], [0.3, 0.4], 1.0, "A"],
    ["smear", 0.6, [1.1, 1.8], [1.0, 1.4], 0.9, "A"],
  ];
  const pick = (list, R) => {
    let t = R() * list.reduce((s, k) => s + k[1], 0);
    for (const k of list) { if ((t -= k[1]) <= 0) return k; }
    return list[0];
  };

  G.SchoolWear = {
    CELLS,
    mark, scrawl,

    // live: a tier is drawn from its quality up
    applyQuality(game, q) {
      const r = RANK[q] != null ? RANK[q] : 2, on = new Map();
      [marks, words].forEach((A) => A && Object.keys(A.mats).forEach((k) => on.set(A.mats[k], r >= TIER[k])));
      if (!on.size || !game.scene) return;
      game.scene.traverse((o) => { if (o.isMesh && on.has(o.material)) o.visible = on.get(o.material); });
    },

    // ---- inside: called by js/schooldress.js interior() with its wall runs
    // and its test for a free spot on a wall -------------------------------------
    build(ctx) {
      const { scene, world, walls, specs, free, placed, api } = ctx;
      const P = G.SchoolDress.P, R = G.makeRng(2718);
      const counts = { decals: 0, words: 0, doors: 0, cables: 0 };
      // (the paint above the dado stands 1.6 cm proud, the dado 2.5 cm: a
      // decal sits just in front of whichever it is on)
      const put = (w, t, y, m, sw, sh, rot) => {
        const y0 = y - sh / 2, y1 = y + sh / 2;
        if (y0 < 1.2 && y1 > 1.1) return false;
        if (w.doors.some((d) => Math.abs(t - d) < 1.62 + sw / 2)) return false;
        if (t - sw / 2 < w.from - 0.25 || t + sw / 2 > w.to + 0.25) return false;
        const holes = w.axis === "z" && G.SchoolShell && G.SchoolShell.holesIn ? G.SchoolShell.holesIn(world, w.fixed, w.y) : [];
        if (holes.some((h) => Math.abs(h.z - t) < h.w / 2 + sw / 2 + 0.05 && w.y + y1 > h.y0 - 0.05 && w.y + y0 < h.y1 + 0.05)) return false;
        const bx = P.wallBox(w, t - sw / 2, t + sw / 2, 0.21, 0.36, w.y + y0, w.y + y1);
        if (!free(bx)) return false;
        placed.push(bx);
        m.position.copy(P.wallPoint(w, t, y1 <= 1.12 ? 0.229 : 0.221, w.y + y));
        m.rotation.set(0, P.faceRotY(w), rot || 0);
        scene.add(m);
        log.push({ w, t, sw, y0: w.y + y0, y1: w.y + y1 });
        return true;
      };
      const log = world.wearMarks = [];                       // (where each went: tools/round10-test.js)
      walls.forEach((w) => {
        const len = w.to - w.from;
        const want = w.kind === "corridor" ? Math.round(len / 1.3) : 3 + Math.floor(R() * 4);
        for (let k = 0, tries = 0; k < want && tries < want * 4; tries++) {
          const K = pick(KINDS, R), sw = K[3][0] + R() * (K[3][1] - K[3][0]), sh = sw * K[4];
          const y = K[2][0] + sh / 2 + R() * Math.max(0, K[2][1] - K[2][0] - sh);
          const t = w.from + sw / 2 + R() * Math.max(0.01, len - sw);
          if (put(w, t, y, mark(K[0], sw, sh, K[5]), sw, sh, K[0] === "hand" ? (R() - 0.5) * 0.5 : 0)) { k++; counts.decals++; }
        }
        // what the last people here wrote on the walls
        const nw = w.kind === "corridor" ? Math.round(len / 24) : R() < 0.15 ? 1 : 0;
        for (let k = 0; k < nw; k++) {
          const n = 7 + Math.floor(R() * 8), sw = 2.0 + R() * 0.6, sh = sw / 4;
          for (let tries = 0; tries < 6; tries++) {
            if (put(w, w.from + sw / 2 + R() * Math.max(0.01, len - sw), 1.55 + R() * 0.8, scrawl(n, sw, sh, "A"), sw, sh, (R() - 0.5) * 0.1)) { counts.words++; break; }
          }
        }
      });

      // ---- the floor: blood pooled, and dragged away ----
      const floors = [];
      (api.storeyList || []).forEach((fl) => floors.push({ x0: -api.HALF + 0.6, x1: api.HALF - 0.6, z0: api.corrZ0 + 1, z1: api.corrZ1 - 1, y: api.baseOf ? api.baseOf(fl) : 0, corr: true }));
      specs.forEach((s) => floors.push({ x0: s.room.cx - s.room.w / 2 + 0.8, x1: s.room.cx + s.room.w / 2 - 0.8, z0: s.room.cz - s.room.d / 2 + 0.8, z1: s.room.cz + s.room.d / 2 - 0.8, y: s.baseY || 0 }));
      floors.forEach((f) => {
        const n = f.corr ? 4 : R() < 0.35 ? 1 : 0;
        for (let k = 0; k < n; k++) {
          const drag = R() < 0.4, sz = drag ? 2.2 + R() * 1.4 : 0.9 + R() * 0.8;
          const m = mark(drag ? "drag" : "pool", sz, drag ? sz * 0.3 : sz * 0.85, "A");
          m.rotation.set(-Math.PI / 2, 0, f.corr && drag ? Math.PI / 2 + (R() - 0.5) * 0.4 : R() * Math.PI * 2);
          m.position.set(f.x0 + R() * (f.x1 - f.x0), f.y + 0.006, f.z0 + R() * (f.z1 - f.z0));
          scene.add(m); counts.decals++;
        }
      });

      // ---- locker doors hanging off their hinges (world.js keeps where the
      // corridor lockers are) ----
      const probe = new THREE.Vector3();
      (world.corridorLockers || []).forEach((L) => {
        if (R() > 0.34) return;
        // (still there: the doorway sweep in js/world.js may have taken it)
        if (!world.colliders.some((c) => c.containsPoint(probe.set(L.x, L.y + 1, L.z)))) return;
        const col = P.lam(L.color), dark = P.basic(0x0c0c0e), n = -L.side;   // n: out into the corridor
        // the left door (hinged at the -z edge) or the right one (at +z)
        const left = R() < 0.5, hz = L.z + (left ? -0.45 : 0.45), mid = hz + (left ? 0.225 : -0.225);
        const face = L.x + n * 0.25;
        // the dark inside where the door was, and a shelf in it
        P.box(scene, 0.012, 1.9, 0.42, dark, face + n * 0.006, L.y + 1.05, mid);
        P.box(scene, 0.012, 0.03, 0.4, P.lam(0x55585c), face + n * 0.008, L.y + 1.6, mid);
        const g = new THREE.Group();
        g.position.set(face + n * 0.02, L.y + 1.05 - (R() < 0.5 ? 0.18 : 0), hz);
        // swung out into the corridor, sagging off its top hinge (in its own
        // frame the door runs +z from the hinge)
        const swing = n * (0.9 + R() * 0.9);
        g.rotation.set(0.12 + R() * 0.25, left ? swing : Math.PI - swing, 0, "YXZ");
        scene.add(g);
        P.box(g, 0.025, 1.9, 0.42, col, 0, 0, 0.21);
        for (let k = 0; k < 3; k++) P.box(g, 0.03, 0.02, 0.26, dark, 0, 0.7 - k * 0.07, 0.21);
        P.box(g, 0.07, 0.12, 0.03, P.lam(0x9aa0a6), 0, 0, 0.36);                            // the handle
        counts.doors++;
      });

      // ---- cables hanging out of the ceiling where a tile came down ----
      const cable = P.lam(0x1c1c1e), cableR = P.lam(0x6a2a1a), hole = P.basic(0x08090b);
      const hang = (x, z, top) => {
        P.box(scene, 0.62, 0.012, 0.62, hole, x, top - 0.012, z);
        const n = 2 + Math.floor(R() * 3);
        for (let k = 0; k < n; k++) {
          let px = x + (R() - 0.5) * 0.4, py = top - 0.02, pz = z + (R() - 0.5) * 0.4;
          const drop = 0.4 + R() * 0.9, segs = 5, m = R() < 0.3 ? cableR : cable;
          let ax = (R() - 0.5) * 0.5, az = (R() - 0.5) * 0.5;
          for (let s = 0; s < segs; s++) {
            const qx = px + ax * drop / segs, qy = py - drop / segs, qz = pz + az * drop / segs;
            const mid = new THREE.Vector3((px + qx) / 2, (py + qy) / 2, (pz + qz) / 2), dir = new THREE.Vector3(qx - px, qy - py, qz - pz);
            const piece = P.box(scene, 0.018, dir.length() + 0.01, 0.018, m, mid.x, mid.y, mid.z);
            piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
            px = qx; py = qy; pz = qz; ax *= 0.7; az *= 0.7; ax += (R() - 0.5) * 0.3; az += (R() - 0.5) * 0.3;
          }
          if (R() < 0.5) P.box(scene, 0.05, 0.04, 0.04, P.lam(0x8a8a86), px, py - 0.02, pz);   // a connector
        }
        counts.cables++;
      };
      floors.forEach((f) => {
        const n = f.corr ? Math.round((f.z1 - f.z0) / 14) : R() < 0.3 ? 1 : 0;
        for (let k = 0; k < n; k++) hang(f.x0 + 0.6 + R() * (f.x1 - f.x0 - 1.2), f.z0 + 0.6 + R() * (f.z1 - f.z0 - 1.2), f.y + 3.39);
      });
      world.wearCounts = counts;
    },

    // ---- outside: the long sides of the classroom block (js/schoolshell.js
    // build, which knows where its windows and pipes are) ----
    outside(ctx) {
      const { scene, sides, avoid } = ctx;
      const R = G.makeRng(3141);
      let n = 0;
      sides.forEach((sd) => {
        const want = Math.round((sd.z1 - sd.z0) / 1.8);
        const taken = [];
        for (let k = 0, tries = 0; k < want && tries < want * 5; tries++) {
          const K = pick(OUT, R), sw = K[3][0] + R() * (K[3][1] - K[3][0]), sh = sw * K[4];
          const y = K[2][0] + sh / 2 + R() * Math.max(0, Math.min(sd.y1, K[2][1]) - K[2][0] - sh);
          const z = sd.z0 + sw / 2 + R() * (sd.z1 - sd.z0 - sw);
          const hit = (a) => Math.abs(a.z - z) < a.w / 2 + sw / 2 + 0.1 && Math.abs(a.y - y) < a.h / 2 + sh / 2 + 0.1;
          if (avoid.some((a) => a.s === sd.s && hit(a)) || taken.some(hit)) continue;
          taken.push({ z, y, w: sw, h: sh });
          const m = mark(K[0], sw, sh, K[5]);
          m.position.set(sd.x, y, z); m.rotation.set(0, sd.s > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
          scene.add(m); k++; n++;
        }
        // and a word or two sprayed at the foot of it
        for (let k = 0; k < 2; k++) {
          const sw = 2.2 + R() * 0.8, sh = sw / 4, z = sd.z0 + 3 + R() * (sd.z1 - sd.z0 - 6), y = 1.3 + R() * 0.5;
          const hit = (a) => Math.abs(a.z - z) < a.w / 2 + sw / 2 + 0.1 && Math.abs(a.y - y) < a.h / 2 + sh / 2 + 0.1;
          if (avoid.some((a) => a.s === sd.s && hit(a)) || taken.some(hit)) continue;
          taken.push({ z, y, w: sw, h: sh });
          const m = scrawl(7 + Math.floor(R() * 8), sw, sh, "A");
          m.position.set(sd.x + sd.s * 0.002, y, z); m.rotation.set(0, sd.s > 0 ? Math.PI / 2 : -Math.PI / 2, (R() - 0.5) * 0.08);
          scene.add(m); n++;
        }
      });
      return n;
    },
  };
})();
