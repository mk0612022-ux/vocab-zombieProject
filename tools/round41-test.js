// Dev-only (not shipped). The story series' round 3: the voxel kit (js/story/voxeltex.js,
// voxel.js, voxelchars.js, voxelprops.js, voxelkit.js).
//   A  the campaign first: nothing of the kit made, its zombies as they were; then the atlases,
//      drawn in code (canvases, NearestFilter), every tile and every sheet, the pixel font
//   B  blocks: only the faces that can be seen, the corners' AO, glass, a facing block, a
//      box's tiles stretched or one a metre, a line turned on the top face, joined colliders
//   C  characters: all 37 looks build (round 5: and the six candidates of 305); the rig (hips, knees, feet, shoulders, elbows, neck);
//      the six boxes' sizes (8 / 8x12x4 / 4x12x4 px, 1.8 m); a face's pixels; a sheet's UVs;
//      the LEXA patch (1, the principal's 3, none for the bitten) lit and dimmed; Blood & Gore
//      Off: no red; the Ironclad's cap a helmet that can be knocked off
//   D  a chapter's zombies built of blocks: the look, the rig posed by js/zombieanim.js, a head
//      shot and a body shot (js/aim.js), a kill, the head knocked off; the patch lit under the
//      crosshair; fewer meshes than a campaign zombie; G.CONFIG.story.voxel.zombies false: the
//      campaign's look
//   E  the gallery (a hidden chapter): straight in, everything in it, every prop in the list,
//      nothing written to the save, the lock-on demo, the lobby's card only with ?kit=1
//   F  the budget: texture memory and meshes against the campaign's (numbers)
//   G  leaving: the campaign after it as it was (no voxel material, no voxel zombie)
// Load it into the game (in the lobby), then:
//   const r = await G.Round41Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round41Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t41 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, VT = G.VoxelTex, V = G.Voxel, VC = G.VoxelChars, VP = G.VoxelProps;
    const backup = JSON.stringify(G.save), lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled, vz0 = G.CONFIG.story.voxel.zombies;
    const real = g._update0 || g.update;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const step = (n, dt) => { for (let i = 0; i < n; i++) real.call(g, dt || 1 / 60); };
    const settle = () => { g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs(); step(2); };
    const play = (fn) => { g.update = real; fn(); settle(); };
    const at = (x, z, y) => { g.teleportPlayer(new THREE.Vector3(x, y || 0, z)); step(2); };
    // (story round 4: a zone of the chapter's map, by name -- its middle, on its storey)
    const toZone = (name) => { const q = G.STORY_CHAPTERS.ch1.zones[name]; at((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, q.y); };
    const alive = () => g.zombies.filter((z) => z.alive);
    const quit = () => { if (G.Dialog.isOpen()) G.Dialog.close(); g.update = real; if (g.state !== "MENU") g.quitToMainMenu(); g.update = () => {}; G.Modal.reset(); };
    const drawn = (root) => { let n = 0; root.traverseVisible((o) => { if (o.isMesh && !o.userData.hit && !o.userData.outline) n++; }); return n; };
    const voxelMats = (scene) => { let n = 0; scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((m) => { if (m && m.userData && (m.userData.voxel || m.userData.voxelChar || (m.userData.vzFrom && m.userData.vzFrom.userData && m.userData.vzFrom.userData.voxel))) n++; }); }); return n; };
    // the bytes of every texture the scene's materials use (mip-mapped: a third more)
    const texBytes = (scene) => {
      const seen = new Set();
      let b = 0;
      scene.traverse((o) => {
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        ms.forEach((m) => ["map", "emissiveMap", "roughnessMap", "metalnessMap", "normalMap", "alphaMap", "lightMap", "aoMap", "bumpMap"].forEach((k) => {
          const t = m && m[k];
          if (!t || seen.has(t.uuid)) return;
          seen.add(t.uuid);
          const img = t.image || {}, w = img.width || 0, h = img.height || 0;
          const mip = t.generateMipmaps !== false && t.minFilter !== THREE.NearestFilter && t.minFilter !== THREE.LinearFilter ? 4 / 3 : 1;
          b += w * h * 4 * mip;
        }));
      });
      return Math.round(b);
    };
    const isRed = (c) => c && c.r > c.g * 1.6 && c.r > c.b * 1.6 && c.r > 0.15;

    // (story round 6: scenes 1-1 and 1-2 are the design's now -- the run's shell this suite tries
    // (zones, groups, checkpoints, a scene's HUD) goes on the stand-ins it was written for, put back after)
    const CHS = G.STORY_CHAPTERS.ch1.scenes, real12 = CHS.slice(1, 3);
    CHS.splice(1, 2,
      { id: "s1", title: "story.ch1.s1", objective: "story.ch1.s1.obj", start: { x: -1.5, y: 8, z: 0.4, yaw: -Math.PI / 2 }, clock: "08:50", light: "alarm", beats: [
        { do: [["objective", "story.ch1.s1.obj"]] },
        { wait: { zone: "corridor3East" }, do: [["banner", "story.ph.group"], ["spawn", { id: "c1", at: "corridor3Far", count: 3 }]] },
        { wait: { cleared: "c1" }, do: [["banner", "story.ph.clear"], ["checkpoint"], ["next"]] }] },
      { id: "s2", title: "story.ch1.s2", objective: "story.ch1.s2.obj", start: { x: 25.5, y: 4, z: -0.5, yaw: Math.PI / 2 }, clock: "09:10", light: "blackout", beats: [
        { do: [["objective", "story.ch1.s2.obj"]] },
        { wait: { zone: "libraryBack" }, do: [["spawn", { id: "r1", at: "wing2", count: 2 }]] },
        { wait: { cleared: "r1" }, do: [["checkpoint"], ["next"]] }] });
    try {
      G.CONFIG.story.enabled = true;
      // ================= A: the campaign first, then the atlases =================
      {
        ok("A nothing of the kit made before a chapter", !VT.made && !VC.made);
        play(() => g.startLevel(1));
        const cz = g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(0, 0, -6)), null);
        step(2);
        ok("A the campaign: its zombie as before (no voxel look), no voxel material, the kit still not made", cz && !cz.look.voxel && !cz.mesh.userData.voxel && voxelMats(g.scene) === 0 && !VT.made && !VC.made);
        numbers.campaignTexKB = Math.round(texBytes(g.scene) / 1024);
        numbers.campaignZombieMeshes = drawn(cz.mesh);
        step(2); g.renderFrame(); numbers.campaignCalls = g.renderer.info.render.calls;
        quit();

        const t0 = performance.now();
        const tex = VT.texture(), c = VT.canvas();
        numbers.blockAtlasMs = Math.round(performance.now() - t0);
        ok("A the block atlas: a canvas drawn in code, 128 x 256, pixels kept square (NearestFilter)", tex.image instanceof HTMLCanvasElement && c.width === 128 && c.height === 256 && tex.magFilter === THREE.NearestFilter, c.width + "x" + c.height);
        ok("A 80 tiles, each with its own name", VT.TILES.length === 80 && new Set(VT.TILES).size === 80 && VT.TILES.every((t, i) => VT.IDX[t] === i));
        const px = c.getContext("2d").getImageData(0, 0, 128, 256).data;
        const tileColours = VT.TILES.map((t, i) => {
          const ox = (i % 8) * 16, oy = Math.floor(i / 8) * 16, set = new Set();
          let magenta = 0, clear = 0;
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const q = ((oy + y) * 128 + ox + x) * 4;
            if (px[q + 3] < 255) clear++;
            if (px[q] === 255 && px[q + 1] === 0 && px[q + 2] === 255) magenta++;
            set.add((px[q] << 16) | (px[q + 1] << 8) | px[q + 2]);
          }
          return { t, n: set.size, magenta, clear };
        });
        const flat = tileColours.filter((x) => x.n < 2 || x.magenta || x.clear);
        ok("A every tile drawn: none blank, none missing (no magenta), opaque, at least two shades", !flat.length, flat.map((x) => x.t + ":" + x.n).join());
        const rc = VT.rect("grassTop"), half = 0.5 / 128;
        ok("A a tile's UVs half a texel inside it", Math.abs(rc[0] - (0 * 16 + 0.5) / 128) < 1e-9 && rc[2] - rc[0] < 16 / 128 && rc[2] - rc[0] > 15 / 128 - half && rc[1] > 0 && rc[3] <= 1);
        const sf = VT.surface();
        ok("A the atlas's roughness and metalness, a texel a tile (metal shinier than paint)", sf.image.width === 8 && sf.image.height === 16 && (() => { const d = sf.image.data, at = (n) => { const i = VT.IDX[n], q = ((15 - Math.floor(i / 8)) * 8 + (i % 8)) * 4; return [d[q + 1], d[q + 2]]; }; return at("metal")[0] < at("cream")[0] && at("metal")[1] > at("cream")[1]; })());
        ok("A the pixel font: letters, digits, signs; Thai left to the system's font", VT.hasGlyphs("EVACUATION ROUTE - YOU ARE HERE: 305!") && !VT.hasGlyphs(String.fromCharCode(0xe2b, 0xe49, 0xe2d, 0xe07)) && VT.textWidth("AB", 2) === 22);
        const sg = VT.sign(["SMART PA", "POWERED BY NEUROLEX"], { scale: 2 });
        ok("A a sign's face: a canvas, its width from its text", sg.tex.image instanceof HTMLCanvasElement && sg.w > VT.textWidth("POWERED BY NEUROLEX", 2) && sg.h > 2 * 14, sg.w + "x" + sg.h);
        const t1 = performance.now();
        const ctex = VC.texture();
        numbers.charAtlasMs = Math.round(performance.now() - t1);
        ok("A the characters' atlas: a canvas drawn in code, 512 x 256, NearestFilter", ctex.image instanceof HTMLCanvasElement && ctex.image.width === 512 && ctex.image.height === 256 && ctex.magFilter === THREE.NearestFilter);
        ok("A 37 looks on it: 12 people, the 7 who turn, 12 everyday zombies, 6 candidates (story round 5), each on a sheet of its own",
          VC.ORDER.length === 37 && VC.CAST.length === 12 && VC.NAMED.length === 7 && VC.GENERIC.students.length + VC.GENERIC.pe.length === 12 && new Set(VC.ORDER.map((id) => VC.SLOT[id])).size === 37 && VC.GENERIC.candidates.length === 6);
        numbers.atlasKB = Math.round((128 * 256 + 512 * 256) * 4 * 4 / 3 / 1024);
      }

      // ================= B: blocks =================
      {
        const sc = new THREE.Scene(), world = { colliders: [] };
        const gr = new V.Grid().fill(0, 0, 0, 2, 2, 2, "concrete");
        const r = gr.build(sc, world, { floorY: -10 });
        ok("B a 3x3x3 cube: only its 54 outer faces, one chunk, one collider the size of the cube",
          r.faces === 54 && r.meshes.length === 1 && r.colliders.length === 1 && r.colliders[0].min.equals(new THREE.Vector3(0, 0, 0)) && r.colliders[0].max.equals(new THREE.Vector3(3, 3, 3)), r.faces + " faces, " + r.colliders.length + " colliders");
        // a floor with a block standing on it: the floor's corners next to the block are darker
        const sc2 = new THREE.Scene(), w2 = { colliders: [] };
        const g2 = new V.Grid().fill(-2, -1, -2, 2, -1, 2, "terrazzo").set(0, 0, 0, "concrete");
        const r2 = g2.build(sc2, w2, { floorY: 0 });
        // (the floor straddles the chunks' lines at 0: every chunk of it read)
        let dark = 0, open = 0;
        r2.meshes.filter((m) => m.userData.voxelChunk === "block").forEach((m) => {
          const P = m.geometry.attributes.position, N = m.geometry.attributes.normal, Cc = m.geometry.attributes.color;
          for (let i = 0; i < P.count; i++) {
            if (N.getY(i) < 0.9 || Math.abs(P.getY(i)) > 1e-6) continue;          // the floor's top
            const x = P.getX(i), z = P.getZ(i), b = Cc.getX(i);
            if (x >= 0 && x <= 1 && z >= 0 && z <= 1) { if (b < 0.99) dark++; } else if ((x === -2 || x === 3) && (z === -2 || z === 3)) { if (b > 0.99) open++; }
          }
        });
        ok("B ambient occlusion: the floor darkened round the block's foot, open corners left bright", dark >= 4 && open === 4, dark + " dark, " + open + " open");
        ok("B the floor itself gives no collider; the block on it does (one)", r2.colliders.length === 1 && r2.colliders[0].min.y === 0);
        // glass
        const sc3 = new THREE.Scene(), w3 = { colliders: [] };
        const g3 = new V.Grid().set(0, 0, 0, "glass").set(1, 0, 0, "glass").set(2, 0, 0, "brick");
        const r3 = g3.build(sc3, w3, { floorY: -5 });
        const glassM = r3.meshes.find((m) => m.userData.voxelChunk === "glass"), brickM = r3.meshes.find((m) => m.userData.voxelChunk === "block");
        ok("B glass: see-through, its own mesh; no face between two panes; the brick behind it still drawn", glassM && glassM.material.transparent && glassM.geometry.attributes.position.count === 9 * 4 && brickM.geometry.attributes.position.count === 6 * 4,
          glassM && glassM.geometry.attributes.position.count / 4 + " glass faces");
        // a facing block: books to +x
        const sc4 = new THREE.Scene(), g4 = new V.Grid().set(0, 0, 0, "books", 1);
        const m4 = g4.build(sc4, { colliders: [] }, { colliders: false }).meshes[0], uv = m4.geometry.attributes.uv, nn = m4.geometry.attributes.normal;
        const want = VT.rect("books");
        let front = false;
        for (let i = 0; i < nn.count; i += 4) if (nn.getX(i) > 0.9) front = Math.abs(uv.getX(i) - want[0]) < 1e-6 && Math.abs(uv.getY(i) - want[1]) < 1e-6;
        ok("B a facing block: the bookshelf's spines on the side it faces", front);
        const gm = V.boxGeo(3, 1, 1, "brick", { mode: "meter" }), gs = V.boxGeo(3, 1, 1, "brick");
        ok("B a box: one tile stretched over each face, or one a metre (3 m: three on its long sides)", gs.attributes.position.count === 24 && gm.attributes.position.count === (3 + 3 + 3 + 3 + 1 + 1) * 4, gm.attributes.position.count / 4 + " quads");
        const lz = new V.Grid().set(0, 0, 0, "asphaltLineZ").build(new THREE.Scene(), { colliders: [] }, { colliders: false }).meshes[0];
        const lx = new V.Grid().set(0, 0, 0, "asphaltLine").build(new THREE.Scene(), { colliders: [] }, { colliders: false }).meshes[0];
        const topUV = (m) => { const n = m.geometry.attributes.normal, u = m.geometry.attributes.uv; for (let i = 0; i < n.count; i += 4) if (n.getY(i) > 0.9) return [u.getX(i), u.getY(i)]; return null; };
        ok("B a line painted along z: the tile turned on the top face", JSON.stringify(topUV(lz)) !== JSON.stringify(topUV(lx)));
        [sc, sc2, sc3, sc4].forEach((s) => s.traverse((o) => { if (o.geometry) o.geometry.dispose(); }));
      }

      // ================= C: characters =================
      {
        const P = G.CONFIG.story.voxel.px;
        const bad = [];
        const models = {};
        VC.ORDER.forEach((id) => {
          try {
            const zt = VC.DEFS[id].zombie ? "normal" : null;
            const m = VC.build(id, zt ? { zombie: zt } : {});
            models[id] = m;
            const L = m.userData.limbs, hb = m.userData.hitboxes.map((h) => h.userData.hit);
            const rig = L.armL.shoulder && L.armL.elbow && L.armR.shoulder && L.armR.elbow && L.legL.hip && L.legL.knee && L.legL.foot && L.legR.hip && L.legR.knee && L.legR.foot && m.userData.upper && m.userData.neck && m.userData.neck.userData.isNeck;
            const parts = ["head", "body", "arm", "hand", "leg"].every((p) => hb.includes(p));
            if (!rig || !parts || drawn(m) > 8) bad.push(id + (rig ? "" : ":rig") + (parts ? "" : ":hitboxes") + ":" + drawn(m));
          } catch (e) { bad.push(id + ":" + e.message); }
        });
        ok("C all 37 build, each rigged as the zombies are (hips, knees, feet, shoulders, elbows, the neck), hit part by part, 8 meshes at most", !bad.length, bad.join() || "37");
        const p = models.player;
        p.updateMatrixWorld(true);
        const size = (o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
        const head = p.userData.neck.children.find((o) => o.name === "head"), body = p.userData.upper.children.find((o) => o.name === "body");
        const hs = size(head), bs = size(body), ls = size(p.userData.limbs.legL.hip.children[0]), as = size(p.userData.limbs.armL.shoulder.children[0]);
        const near = (a, b) => Math.abs(a - b) < 0.004;
        ok("C the six boxes in the doc's sizes: head 8x8x8 px, body 8x12x4, arms and legs 4x12x4",
          near(hs.x, 8 * P) && near(hs.y, 8 * P) && near(bs.x, 8 * P) && near(bs.y, 12 * P) && near(bs.z, 4 * P) && near(ls.x, 4 * P) && near(ls.y, 12 * P) && near(as.y, 12 * P),
          [hs.x, bs.y, ls.y].map((v) => v.toFixed(3)).join("/"));
        // (its drawn parts: not its hitboxes, padded and hidden)
        const tall = (() => { const b = new THREE.Box3(); p.traverseVisible((o) => { if (o.isMesh && !o.userData.hit) { o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } }); return b.max.y; })();
        ok("C a person 32 pixels tall: 1.8 m", Math.abs(tall - 32 * P) < 0.01, tall.toFixed(3));
        // the face: the sheet's front of the head, read back from the atlas
        const cvs = VC.canvas(), cx = cvs.getContext("2d");
        const pix = (id, x, y) => { const s = VC.SLOT[id], d = cx.getImageData((s % 8) * 64 + x, Math.floor(s / 8) * 32 + y, 1, 1).data; return (d[0] << 16) | (d[1] << 8) | d[2]; };
        ok("C a face drawn in pixels: eyes white and dark, a zombie's dark sockets", pix("beam", 1, 4) === 0xf4f4f0 && pix("beam", 2, 4) === 0x2a1a10 && pix("beam_z", 1, 4) === 0x2a2a22);
        // the head's UVs on its own sheet
        const s = VC.SLOT.beam, u0 = ((s % 8) * 64) / 512, u1 = ((s % 8) * 64 + 64) / 512, v1 = 1 - (Math.floor(s / 8) * 32) / 256, v0 = 1 - (Math.floor(s / 8) * 32 + 32) / 256;
        const bh = models.beam.userData.neck.children.find((o) => o.name === "head").geometry.attributes.uv;
        let inside = true;
        for (let i = 0; i < bh.count; i++) if (bh.getX(i) < u0 - 1e-6 || bh.getX(i) > u1 + 1e-6 || bh.getY(i) < v0 - 1e-6 || bh.getY(i) > v1 + 1e-6) inside = false;
        ok("C a character's boxes read only its own sheet", inside);
        // the LEXA patch
        const pz = models.beam_z.userData.patch;
        ok("C the LEXA patch: one behind a student's ear, three on the principal's nape, none on the bitten (janitor, Sgt. Chai)",
          pz && pz.n === 1 && models.somsak_z.userData.patch.n === 3 && !models.porn_z.userData.patch && !models.chai_z.userData.patch && models.zm1.userData.patch);
        const col = pz.mesh.geometry.attributes.color, lum = () => col.getX(pz.start) + col.getY(pz.start) + col.getZ(pz.start);
        const l0 = lum(); VC.setLock(models.beam_z, true); const l1 = lum(); VC.setLock(models.beam_z, false); const l2 = lum();
        ok("C ...locked on: it lights up (over 1: it glows), and goes back", l1 > l0 * 2 && l1 > 1 && Math.abs(l2 - l0) < 1e-6, [l0, l1, l2].map((v) => v.toFixed(2)).join(" > "));
        // Blood & Gore
        const reds = (m) => { let n = 0; m.traverse((o) => (o.userData.parts || []).forEach((q) => { if (isRed(q.color)) n++; })); return n; };
        const off = VC.build("zm1", { zombie: "normal", gore: "off" }), full = VC.build("zm1", { zombie: "normal", gore: "full" });
        ok("C Blood & Gore Off: no red anywhere on a zombie (Full: its blood)", reds(off) === 0 && reds(full) > 0, reds(off) + " / " + reds(full));
        const ic = VC.build("chai_z", { zombie: "ironclad" });
        ok("C the Ironclad (Sgt. Chai): his cap a helmet the game can knock off; his vest on", ic.userData.helmet && ic.userData.helmet.children.length > 0 && ic.userData.helmet.children.every((o) => o.userData.helmet));
        const cr = VC.build("zm2", { zombie: "crawler" });
        ok("C a Crawler: on its front, its legs dragging behind (the crawl's own rig)", cr.userData.crawler && cr.userData.torso && cr.userData.limbs.stumpL && cr.userData.limbs.stumpL.isMesh && cr.userData.neck.userData.isNeck && new THREE.Box3().setFromObject(cr).max.y < 0.8);
        Object.values(models).concat([off, full, ic, cr]).forEach((m) => G.disposeObject3D(m));
      }

      // ================= D: a chapter's zombies =================
      {
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        toZone("corridor3East");
        step(30);
        const zs = alive();
        ok("D a chapter's zombies built of blocks (each its own look while there are others)", zs.length >= 3 && zs.every((z) => z.look.voxel && z.mesh.userData.voxel) && new Set(zs.map((z) => z.look.voxel)).size === zs.length, zs.map((z) => z.look.voxel).join());
        const z = zs[0], L = z.mesh.userData.limbs;
        const before = [L.legL.hip.rotation.x, L.armL.shoulder.rotation.x];
        step(40);
        ok("D posed by the zombies' own animation (js/zombieanim.js): the legs swing, the arms reach", Math.abs(L.armL.shoulder.rotation.x) > 0.3 && (L.legL.hip.rotation.x !== before[0] || Math.abs(L.legL.hip.rotation.x) > 0.01), L.armL.shoulder.rotation.x.toFixed(2));
        numbers.voxelZombieMeshes = drawn(z.mesh);
        ok("D a voxel zombie is fewer meshes than a campaign one", numbers.voxelZombieMeshes <= numbers.campaignZombieMeshes && numbers.voxelZombieMeshes <= 8, numbers.voxelZombieMeshes + " vs " + numbers.campaignZombieMeshes);
        // shots (js/aim.js: the parts as drawn; anything on the neck is the head)
        z.mesh.updateMatrixWorld(true);
        // (story round 4: from its own floor, 4 m down the corridor -- the chapter's map puts it on 3F)
        const eye = new THREE.Vector3(z.mesh.position.x - 4, z.mesh.position.y + 1.6, z.mesh.position.z);
        const headAt = z.mesh.userData.neck.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.22 * z.mesh.scale.y, 0));
        const bodyAt = z.mesh.userData.upper.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.34 * z.mesh.scale.y, 0));
        g.camera.updateMatrixWorld();
        const hitAt = (pt) => { const dir = pt.clone().sub(eye).normalize(); return G.Aim.trace(g, eye.clone().add(dir.clone().multiplyScalar(0.01)).setX(eye.x + 0.0001), dir, 20, [z], true); };
        const hh = hitAt(headAt), hb = hitAt(bodyAt);
        ok("D a head shot hits the head, a body shot the body", hh.length && hh[0].z === z && hh[0].head === true && hb.length && hb[0].z === z && hb[0].head === false, (hh[0] && hh[0].head) + "/" + (hb[0] && hb[0].head));
        // the LexiLens locks on: the patch of the zombie under the crosshair
        const pt = z.mesh.userData.patch;
        G.Aim.hover = z; VC.update(g);
        const lit = pt && pt.lit;
        G.Aim.hover = null; VC.update(g);
        ok("D the zombie under the crosshair: its LEXA patch lit; looked away from: dim again", lit === true && pt.lit === false);
        // a kill: the head off (Blood & Gore Full), then the rest into blocks
        const gore0 = G.save.settings.gore;
        G.save.settings.gore = "full";
        g.damageZombie(z, 9999, headAt, { dir: new THREE.Vector3(0, 0, -1), head: true });
        const d = (G.ZombieFX.dying || []).find((q) => q.z === z);
        ok("D a head shot kill: the head flies off (the neck and what is on it)", !z.alive && d && d.mode === "decap" && d.head && d.head.obj === z.mesh.userData.neck);
        step(90);
        ok("D ...and the body bursts into blocks of its own colours (gone, no error)", !(G.ZombieFX.dying || []).some((q) => q.z === z) && !z.mesh.parent);
        G.save.settings.gore = gore0;
        quit();
        // the campaign's look, if the flag says so
        G.CONFIG.story.voxel.zombies = false;
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        toZone("corridor3East"); step(10);
        ok("D G.CONFIG.story.voxel.zombies false: a chapter's zombies in the campaign's look", alive().length && alive().every((q) => !q.look.voxel && !q.mesh.userData.voxel));
        G.CONFIG.story.voxel.zombies = vz0;
        quit();
      }

      // ================= E: the gallery =================
      {
        const story0 = JSON.stringify(G.save.story || null);
        play(() => S.open("kit"));
        step(4);
        const gal = G.VoxelKit.gallery;
        ok("E the gallery: a hidden chapter, straight in (no window), its own place", g.mode === "story" && g.level.kit && gal && !G.Dialog.isOpen() && S.chapters().every((c) => c.id !== "kit"));
        ok("E everyone in it: the 12 people, the 7 who turn and 5 everyday zombies, a campaign zombie beside a Chapter 1 one", gal.people.length === 12 && gal.zombies.length === 14 && gal.compare && !gal.compare[0].look.voxel && gal.compare[1].look.voxel);
        const missing = VP.LIST.filter((id) => !gal.props.includes(id));
        ok("E every prop of the kit's list in it (" + VP.LIST.length + ")", VP.LIST.length >= 25 && !missing.length, missing.join());
        ok("E every tile of the atlas on its north wall; the shell of blocks: chunks, colliders", gal.built.meshes.length >= 4 && gal.built.colliders.length >= 4 && gal.built.faces > 2000, gal.built.faces + " faces, " + gal.built.meshes.length + " chunks");
        numbers.galleryFaces = gal.built.faces; numbers.galleryChunks = gal.built.meshes.length; numbers.galleryBuildMs = gal.ms;
        const people = gal.people.every((q) => q.model.parent && (g.world.noMerge || []).includes(q.model));
        ok("E the people and zombies stand apart from the level's merge (they move)", people && gal.zombies.every((q) => (g.world.noMerge || []).includes(q.z.mesh)));
        const wv = gal.people.find((q) => q.st.wave).model.userData.limbs.armR.shoulder.rotation.x;
        ok("E they move: someone waves (arm up)", wv < -2, wv.toFixed(2));
        // the lock-on demo: the zombie straight ahead
        const tz = gal.zombies[0].z;
        g.teleportPlayer(new THREE.Vector3(tz.mesh.position.x, 0, tz.mesh.position.z + 5)); g.yawObject.rotation.y = 0; g.pitchObject.rotation.x = -0.05;
        step(3);
        ok("E the zombie aimed at has its patch lit", gal.locked === tz && tz.mesh.userData.patch.lit === true);
        // per-pixel light from Medium up: the grid's chunks too, with the atlas's roughness
        const chunk = g.world.voxelMeshes[0];
        const pbr = G.Visuals && G.Visuals.ready && G.Visuals.cfgQ().pbr !== false;
        ok("E the blocks lit as the level is (per pixel from Medium up, the atlas's roughness)", pbr ? chunk.material.isMeshStandardMaterial && chunk.material.roughnessMap === VT.surface() : chunk.material.isMeshLambertMaterial, chunk.material.type);
        g.renderFrame();
        numbers.galleryCalls = g.renderer.info.render.calls;
        numbers.galleryTexKB = Math.round(texBytes(g.scene) / 1024);
        quit();
        ok("E nothing of the gallery in the save", JSON.stringify(G.save.story || null) === story0 && !(G.save.story && G.save.story.ch && (G.save.story.ch.kit || G.save.story.ch.ch99)));
        const lob0 = G.Lobby.modes("story").some((m) => m.id === "storykit");
        const on0 = G.VoxelKit.on; G.VoxelKit.on = () => true;
        const lob1 = G.Lobby.modes("story").some((m) => m.id === "storykit");
        G.VoxelKit.on = on0;
        ok("E the lobby's card: only with ?kit=1 in the address", !lob0 && lob1);
      }

      // ================= F: the budget =================
      {
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        toZone("corridor3East"); step(10);
        g.renderFrame();
        numbers.storyCalls = g.renderer.info.render.calls;
        numbers.storyTexKB = Math.round(texBytes(g.scene) / 1024);
        ok("F texture memory: the kit's two atlases under 1 MB together (the campaign's level: " + numbers.campaignTexKB + " KB)", numbers.atlasKB < 1024, numbers.atlasKB + " KB");
        quit();
      }

      // ================= G: leaving =================
      {
        play(() => g.startLevel(1));
        const z = g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(0, 0, -6)), null);
        step(2);
        ok("G the campaign after a chapter: its zombies as they were, no voxel material in its scene", z && !z.look.voxel && voxelMats(g.scene) === 0);
        quit();
      }
      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      CHS.splice(1, 2, ...real12);
      G.CONFIG.story.enabled = enabled0;
      G.CONFIG.story.voxel.zombies = vz0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      G.Modal.reset();
      if (g.state !== "MENU") g.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist(true);
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
