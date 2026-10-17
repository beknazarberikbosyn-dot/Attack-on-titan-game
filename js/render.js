// Отрисовка: камера, карта, анимации, титаны, солдаты, эффекты, подписи
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const W = A.WORLD, G = A.G;

  A.cam = { x: 1500, y: 2700, z: 1.5 };
  A.ZOOMS = [0.17, 0.22, 0.3, 0.4, 0.55, 0.75, 1, 1.5, 2, 3, 4, 6];
  A.view = { cw: 800, ch: 600, dpr: 1 };
  A.mouse = { x: 0, y: 0, wx: 0, wy: 0, inside: false };

  A.screenToWorld = (sx, sy) => ({ x: A.cam.x + sx / A.cam.z, y: A.cam.y + sy / A.cam.z });
  A.worldToScreen = (wx, wy) => ({ x: (wx - A.cam.x) * A.cam.z, y: (wy - A.cam.y) * A.cam.z });
  A.clampCam = function () {
    const vw = A.view.cw / A.cam.z, vh = A.view.ch / A.cam.z;
    const mx = Math.max(0, W.W - vw), my = Math.max(0, W.H - vh);
    A.cam.x = vw > W.W ? (W.W - vw) / 2 : A.clamp(A.cam.x, 0, mx);
    A.cam.y = vh > W.H ? (W.H - vh) / 2 : A.clamp(A.cam.y, 0, my);
  };
  A.zoomAt = function (sx, sy, dir) {
    const zs = A.ZOOMS;
    let i = zs.findIndex((z) => z >= A.cam.z - 0.001);
    if (i < 0) i = zs.length - 1;
    const ni = A.clamp(i + dir, 0, zs.length - 1);
    const before = A.screenToWorld(sx, sy);
    A.cam.z = zs[ni];
    A.cam.x = before.x - sx / A.cam.z; A.cam.y = before.y - sy / A.cam.z;
    A.clampCam();
  };
  A.centerOn = function (wx, wy) {
    A.cam.x = wx - A.view.cw / A.cam.z / 2; A.cam.y = wy - A.view.ch / A.cam.z / 2; A.clampCam();
  };

  // ---------- Солдатик (3×7 пикселей) ----------
  const SKIN = ['#e8c0a0', '#d9a888', '#c99a7a', '#f0cdb0'];
  const HAIR = ['#2a2018', '#5a3a22', '#c9a24a', '#1c1c20', '#7a4a2a', '#9a9aa0'];
  function soldier(c, x, y, cape, seed, opts) {
    x = Math.round(x); y = Math.round(y);
    const s = SKIN[seed % SKIN.length], h = (opts && opts.hair) || HAIR[(seed * 3) % HAIR.length];
    const step = opts && opts.walk ? (Math.floor(opts.walk * 6) % 2) : 0;
    c.fillStyle = cape; c.fillRect(x - 2, y - 5, 1, 4);             // плащ
    c.fillStyle = '#6e4e30'; c.fillRect(x - 1, y - 5, 3, 3);        // куртка
    c.fillStyle = '#3a2a1c'; c.fillRect(x - 1, y - 3, 3, 1);        // ремни
    c.fillStyle = '#b8c0c8'; c.fillRect(x + 2, y - 4, 1, 2);        // баллоны УПМ
    c.fillStyle = '#ece6d8'; c.fillRect(x - 1, y - 2 + step, 1, 2 - step); c.fillRect(x + 1, y - 2, 1, 2); // ноги
    c.fillStyle = s; c.fillRect(x - 1, y - 7, 2, 2);                // голова
    c.fillStyle = h; c.fillRect(x - 1, y - 8, 2, 1);
    if (opts && opts.blade) { c.fillStyle = '#e8f0ff'; c.fillRect(x + (opts.face > 0 ? 2 : -3), y - 5, 2, 1); }
  }
  A.drawSoldier = soldier;

  // белые силуэты для вспышки урона
  const flashCache = new WeakMap();
  function whiteOf(cv) {
    let w = flashCache.get(cv);
    if (w) return w;
    w = document.createElement('canvas'); w.width = cv.width; w.height = cv.height;
    const c = w.getContext('2d'); c.drawImage(cv, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, w.width, w.height);
    flashCache.set(cv, w); return w;
  }

  // окрашенная копия спрайта (кристалл, броня)
  const tintCache = new Map();
  function tintOf(cv, col) {
    let m = tintCache.get(col); if (!m) { m = new WeakMap(); tintCache.set(col, m); }
    let w = m.get(cv); if (w) return w;
    w = document.createElement('canvas'); w.width = cv.width; w.height = cv.height;
    const c = w.getContext('2d'); c.drawImage(cv, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = col; c.fillRect(0, 0, w.width, w.height);
    m.set(cv, w); return w;
  }

  // облака-тени
  let cloudSprites = null;
  function clouds() {
    if (cloudSprites) return cloudSprites;
    cloudSprites = [];
    for (let i = 0; i < 7; i++) {
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 22;
      const c = cv.getContext('2d'); c.fillStyle = '#000';
      for (let k = 0; k < 7; k++) { const cx = 8 + Math.random() * 24, cy = 7 + Math.random() * 8, r = 4 + Math.random() * 6; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); }
      cloudSprites.push({ cv, x: Math.random() * W.W, y: Math.random() * W.H, sp: 5 + Math.random() * 6 });
    }
    return cloudSprites;
  }

  function ell(c, x, y, rx, ry, col) {
    c.fillStyle = col;
    for (let dy = -ry; dy <= ry; dy++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.01))));
      c.fillRect(Math.round(x - w), Math.round(y + dy), w * 2, 1);
    }
  }

  // ---------- Главная отрисовка ----------
  A.render = function (ctx, time) {
    const { cw, ch, dpr } = A.view;
    const cam = A.cam;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#20251b';
    ctx.fillRect(0, 0, cw * dpr, ch * dpr);
    const sh = G.shake > 0 ? G.shake * 5 : 0;
    const z = cam.z * dpr;
    const ox = Math.round((-cam.x + (Math.random() - 0.5) * sh) * z), oy = Math.round((-cam.y + (Math.random() - 0.5) * sh) * z);
    ctx.setTransform(z, 0, 0, z, ox, oy);

    const vx0 = Math.max(0, Math.floor(cam.x) - 2), vy0 = Math.max(0, Math.floor(cam.y) - 2);
    const vx1 = Math.min(W.W, Math.ceil(cam.x + cw / cam.z) + 2), vy1 = Math.min(W.H, Math.ceil(cam.y + ch / cam.z) + 2);
    const inView = (x, y, m) => x > vx0 - (m || 0) && x < vx1 + (m || 0) && y > vy0 - (m || 0) && y < vy1 + (m || 0) + 120;
    ctx.drawImage(A.bg, vx0, vy0, vx1 - vx0, vy1 - vy0, vx0, vy0, vx1 - vx0, vy1 - vy0);

    drawDecor(ctx, time, inView);
    if (A.ui && A.ui.deployCard) drawDeployZone(ctx);
    if (G.sealed) {
      const D = A.DISTRICTS[G.sealedAt || 0], bx = D.gx - D.nx * 4, by = D.gy - D.ny * 4;
      ell(ctx, bx + 4, by + 8, 20, 6, 'rgba(0,0,0,0.3)'); ell(ctx, bx, by - 4, 18, 15, '#8a857c'); ell(ctx, bx - 4, by - 9, 8, 6, '#a29c92');
    }

    // ---- сущности по глубине ----
    const ents = [];
    for (const t of G.titans) if (inView(t.x, t.y, 140)) ents.push(t);
    for (const u of G.units) if (u.state !== 'safe' && inView(u.x, u.y, 60)) ents.push(u);
    ents.sort((a, b) => a.y - b.y);
    // тени
    for (const e of ents) {
      if (e.kind === 'titan') { ell(ctx, e.x + e.def.h * 0.08, e.y, Math.max(3, e.def.w * 0.6), Math.max(1, e.def.w * 0.2), `rgba(10,12,8,${e.dead ? 0.15 : 0.32})`); if (e.def.special && !e.dead) ell(ctx, e.x, e.y + 1, e.def.w * 0.75, Math.max(2, e.def.w * 0.22), 'rgba(200,40,30,0.18)'); }
      else if (!e.onWall) ell(ctx, e.x + 1, e.y, e.card.kind === 'squad' ? 7 : 3, 1, 'rgba(10,12,8,0.3)');
    }
    for (const e of ents) e.kind === 'titan' ? drawTitan(ctx, e, time) : drawUnit(ctx, e, time);

    drawProjs(ctx);
    drawFx(ctx);

    // облака
    ctx.globalAlpha = 0.09;
    for (const cl of clouds()) {
      const x = ((cl.x + time * cl.sp) % (W.W + 900)) - 450;
      if (x > vx1 || x + 320 < vx0) continue;
      ctx.drawImage(cl.cv, x, cl.y, 320, 176);
    }
    ctx.globalAlpha = 1;
    // ---- экранный слой (подписи) ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMapLabels(ctx);
    drawLabels(ctx, ents);
    drawFloaters(ctx);
    if (A.ui && A.ui.deployCard) drawGhost(ctx);
  };

  function drawDecor(c, time, inView) {
    const D = A.decor;
    // рябь на реке
    c.fillStyle = '#a8d0e6';
    for (const r of D.ripples) { if (!inView(r.x, r.y)) continue; const v = Math.sin(time * 2.2 + r.ph); if (v > 0.55) c.fillRect(Math.round(r.x + v * 2), r.y, 2, 1); }
    // дым из труб
    for (const ch of D.chimneys) {
      if (!inView(ch.x, ch.y, 20)) continue;
      for (let k = 0; k < 3; k++) {
        const age = ((time * 0.35 + ch.ph + k / 3) % 1);
        const s = 1 + Math.round(age * 3);
        c.fillStyle = `rgba(200,200,200,${(1 - age) * 0.45})`;
        c.fillRect(Math.round(ch.x + age * 6 + Math.sin(time + k) * 1.5), Math.round(ch.y - 2 - age * 16), s, s);
      }
    }
    // жители
    const panic = G.titans && G.titans.some((t) => !t.dead && t.atWall);
    if (A.cam.z >= 1) for (const p of D.people) {
      const st = p.s;
      if (!inView(st.x1, st.y1, 200) && !inView(st.x2, st.y2, 200)) continue;
      let q = (p.p + p.v * time * (panic ? 2.2 : 1)) % 2; if (q < 0) q += 2;
      const k = q > 1 ? 2 - q : q;
      const L = Math.hypot(st.x2 - st.x1, st.y2 - st.y1) || 1;
      const x = st.x1 + (st.x2 - st.x1) * k + (-(st.y2 - st.y1) / L) * p.off, y = st.y1 + (st.y2 - st.y1) * k + ((st.x2 - st.x1) / L) * p.off;
      if (!inView(x, y) || (st.inside && !st.inside(x, y))) continue;
      c.fillStyle = p.col; c.fillRect(Math.round(x), Math.round(y) - 2, 1, 2);
      c.fillStyle = '#e0b898'; c.fillRect(Math.round(x), Math.round(y) - 3, 1, 1);
    }
    // мельница
    for (const wm of D.windmills) {
      if (!inView(wm.x, wm.y, 30)) continue;
      const [bx, by] = wm.base;
      c.fillStyle = '#cfc4ae'; c.fillRect(bx - 5, by - 22, 10, 22); c.fillStyle = '#6c4a34'; c.fillRect(bx - 6, by - 26, 12, 5);
      const a0 = time * 0.7;
      c.fillStyle = '#5a3d24';
      for (let b = 0; b < 4; b++) {
        const a = a0 + b * Math.PI / 2;
        for (let r = 2; r < 20; r++) c.fillRect(Math.round(wm.x + Math.cos(a) * r), Math.round(wm.y + Math.sin(a) * r), 1, 1);
        c.fillStyle = '#e8e0cc';
        for (let r = 8; r < 19; r += 2) c.fillRect(Math.round(wm.x + Math.cos(a) * r + Math.cos(a + 1.57) * 2), Math.round(wm.y + Math.sin(a) * r + Math.sin(a + 1.57) * 2), 2, 2);
        c.fillStyle = '#5a3d24';
      }
      c.fillStyle = '#3a2a1a'; c.fillRect(wm.x - 1, wm.y - 1, 3, 3);
    }
    // пушки на Стене Роза: дымок от выстрела рисуют частицы, тут — только расчёты нет
    // флаги
    for (const f of D.flags) {
      if (!inView(f.x, f.y, 10)) continue;
      const w = Math.sin(time * 5 + f.x) > 0 ? 1 : 0;
      c.fillStyle = f.col; c.fillRect(f.x + 1, f.y + w, 6, 4); c.fillRect(f.x + 7, f.y + 1 - w, 2, 3);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(f.x + 1, f.y + 3 + w, 6, 1);
    }
    // огни фонарей, когда титаны у стены — тревога
    if (panic) {
      c.fillStyle = `rgba(255,80,40,${0.35 + Math.sin(time * 8) * 0.2})`;
      for (const Dd of A.DISTRICTS) if (inView(Dd.gx, Dd.gy, 40)) { c.fillRect(Math.round(Dd.gx) - 2, Math.round(Dd.gy) - 30, 4, 4); }
    }
    // птицы
    c.fillStyle = '#2a2a26';
    for (let fl = 0; fl < 4; fl++) {
      const bx = ((time * (14 + fl * 3) + fl * 900) % (W.W + 200)) - 100, by = 400 + fl * 800 + Math.sin(time * 0.4 + fl) * 40;
      for (let b = 0; b < 5; b++) {
        const x = Math.round(bx - b * 7 - (b % 2) * 3), y = Math.round(by + (b % 2) * 4 + b);
        if (!inView(x, y)) continue;
        const flap = Math.sin(time * 9 + b) > 0;
        c.fillRect(x - 1, y - (flap ? 1 : 0), 1, 1); c.fillRect(x, y, 1, 1); c.fillRect(x + 1, y - (flap ? 1 : 0), 1, 1);
      }
    }
  }

  function drawDeployZone(c) {
    c.drawImage(A.deployMask, 0, 0, A.deployMask.width, A.deployMask.height, 0, 0, A.deployMask.width * 8, A.deployMask.height * 8);
    const card = A.CARD[A.ui.deployCard];
    c.strokeStyle = card && card.wallOnly ? 'rgba(120,230,120,0.55)' : 'rgba(255,220,120,0.25)';
    c.lineWidth = A.WALL_T.rose;
    c.beginPath(); c.arc(A.C.x, A.C.y, A.R.rose, 0, Math.PI * 2); c.stroke();
    for (const Dd of A.DISTRICTS) { c.beginPath(); c.arc(Dd.cx, Dd.cy, Dd.r, Dd.ang - 1.75, Dd.ang + 1.75); c.stroke(); }
    c.lineWidth = 1;
  }

  function drawTitan(c, t, time) {
    // каменная корка Бронированного осыпается по мере того, как копья сбивают броню
    const lvl = t.type === 'armored' ? (t.armor <= 0.02 ? 0 : Math.min(3, Math.ceil(t.armor / A.TITANS.armored.armor * 3 - 0.01))) : null;
    const spr = A.titanSprite(t.type, t.variant, t.def.h, t.def.w, lvl);
    const frame = t.crystalT > 0 ? 0 : t.grabT > 0 ? 2 : t.blindT > 0 ? (Math.floor(time * 6) % 2) : (Math.floor(t.anim) % 2);
    const img = spr[frame], k = img.s || 1;
    const dw = img.width / k, dh = img.height / k;
    let x = t.x - dw / 2, y = t.y - dh + 1;
    if (t.def.climber && t.climbed) y -= 10 + Math.sin(time * 10) * 1.5; // карабкается по стене
    // зона раскалённого пара под Колоссальным
    if (t.steamOn && !t.dead) {
      const R0 = t.steamR || 230, pulse = 0.5 + Math.sin(time * 4) * 0.12;
      c.globalAlpha = 0.16 * pulse; ell(c, t.x, t.y, R0, R0 * 0.42, '#ffb36a');
      c.globalAlpha = 0.14 * pulse; ell(c, t.x, t.y, R0 * 0.6, R0 * 0.26, '#ff7a3a');
      c.globalAlpha = 1;
    }
    if (t.dead) c.globalAlpha = Math.max(0, 1 - t.deadT / 1.2);
    c.drawImage(img, x, y, dw, dh);
    if (t.dead) { c.globalAlpha = Math.max(0, 0.85 * (1 - t.deadT / 1.2)); c.drawImage(whiteOf(img), x, y, dw, dh); c.globalAlpha = 1; return; } // испаряется
    // тлеющие трещины Колоссального пульсируют, в пару — разгораются
    if (img.glow) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = Math.max(0, 0.35 + Math.sin(time * 2.6 + t.id) * 0.18 + (t.steamOn ? 0.35 : 0));
      c.drawImage(img.glow, x, y, dw, dh);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
    // кристалл Женской особи
    if (t.crystalT > 0) {
      c.globalAlpha = 0.6; c.drawImage(tintOf(img, '#a8e4ff'), x, y, dw, dh);
      c.globalAlpha = 0.85; c.strokeStyle = '#e8fbff'; c.lineWidth = 0.5;
      c.beginPath();
      for (let i = 0; i < 7; i++) { const sx = t.x + (A.hash(t.id, i, 9) - 0.5) * t.def.w * 1.1, sy = y + dh * (0.1 + A.hash(t.id, i, 8) * 0.85); c.moveTo(sx, sy); c.lineTo(sx + 2, sy - 3); c.lineTo(sx + 3, sy + 1); }
      c.stroke();
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) if (Math.sin(time * 5 + i * 1.7) > 0.7) c.fillRect(t.x + (A.hash(t.id, i, 5) - 0.5) * t.def.w, y + dh * A.hash(t.id, i, 6), 1, 1);
      c.globalAlpha = 1;
    }
    if (t.hitFlash > 0) { c.globalAlpha = 0.7; c.drawImage(whiteOf(img), x, y, dw, dh); c.globalAlpha = 1; }
    if (t.hardenT > 0 && t.crystalT <= 0) { c.globalAlpha = 0.55; c.fillStyle = '#bfe6ff'; c.fillRect(t.x - t.def.w * 0.2, y + dh * 0.14, t.def.w * 0.4, Math.max(1.5, dh * 0.08)); c.globalAlpha = 1; }
    // ярость
    if (t.enrageT > 0) { c.fillStyle = '#ff4a3a'; c.fillRect(t.x - t.def.w * 0.12, y + dh * 0.06, 1, 0.6); c.fillRect(t.x + t.def.w * 0.08, y + dh * 0.06, 1, 0.6); }
    // тросы ловушки
    if (t.rootT > 0) {
      c.fillStyle = 'rgba(220,220,220,0.8)';
      for (let kk = 0; kk < 6; kk++) {
        const a = kk * 1.05 + 0.3, ex = t.x + Math.cos(a) * 46, ey = t.y + Math.sin(a) * 20;
        const n = 30;
        for (let i = 0; i < n; i++) { const p = i / n; c.fillRect(Math.round(A.lerp(t.x, ex, p)), Math.round(A.lerp(t.y - t.def.h * 0.6, ey, p)), 1, 1); }
      }
    }
    if (t.blindT > 0) { c.fillStyle = '#ffef80'; c.fillRect(Math.round(t.x - 4 + Math.sin(time * 8) * 3), y - 3, 1, 1); c.fillRect(Math.round(t.x + 3 - Math.sin(time * 8) * 3), y - 2, 1, 1); }
  }

  function memberPositions(u, time) {
    const n = u.members, res = [];
    const t = u.target;
    const engaged = u.state === 'engage' && t && !t.dead && A.dist(u, t) < t.def.w * 0.5 + 14 && !u.card.range;
    for (let i = 0; i < n; i++) {
      if (engaged) {
        const a = time * 2.6 + i * (6.28 / n) + u.id;
        res.push({ x: t.x + Math.cos(a) * (t.def.w * 0.55 + 4), y: t.y + Math.sin(a) * 3 + 1, z: t.def.h * 0.72 + Math.sin(a * 1.7) * 3, cable: true, t });
      } else {
        const off = [[0, 0], [-6, -3], [6, -2], [-3, 4], [5, 4]][i % 5];
        const bob = u.z > 1 ? Math.sin(time * 3 + i) * 1.5 : 0;
        res.push({ x: u.x + off[0], y: u.y + off[1], z: u.z + bob });
      }
    }
    return res;
  }

  function drawUnit(c, u, time) {
    const card = u.card;
    if (u.dead) c.globalAlpha = Math.max(0, 1 - u.deadT / 2);
    const sel = A.ui && A.ui.selected === u;
    if (sel) { ell(c, u.x, u.y + 1, card.kind === 'squad' ? 10 : 5, 2, 'rgba(255,220,120,0.55)'); }
    // Эрен-титан
    if (card.ability === 'shifter' && u.form === 'titan') {
      const spr = A.titanSprite('eren', 0);
      const img = spr[u.punch > 0 ? 2 : Math.floor(u.anim * 2) % 2], k = img.s || 1;
      ell(c, u.x, u.y + 1, 10, 3, 'rgba(60,200,120,0.25)');
      c.drawImage(img, u.x - img.width / k / 2, u.y - img.height / k + 1, img.width / k, img.height / k);
      if (u.carry) { ell(c, u.x, u.y - 34, 9, 7, '#8a857c'); ell(c, u.x - 2, u.y - 36, 4, 3, '#a29c92'); }
      c.globalAlpha = 1; return;
    }
    if (card.kind === 'squad') {
      const ms = memberPositions(u, time);
      ms.forEach((m, i) => {
        if (m.cable) {
          c.fillStyle = 'rgba(230,230,230,0.55)';
          const ax = m.t.x + (i % 2 ? 1 : -1) * m.t.def.w * 0.3, ay = m.t.y - m.t.def.h * 0.85;
          const n = 10;
          for (let k = 0; k < n; k++) c.fillRect(Math.round(A.lerp(m.x, ax, k / n)), Math.round(A.lerp(m.y - m.z - 4, ay, k / n)), 1, 1);
        }
        if (m.z > 2) ell(c, m.x, m.y, 2, 1, 'rgba(0,0,0,0.25)');
        soldier(c, m.x, m.y - m.z, card.color, u.id * 7 + i, { walk: u.z < 1 && u.state !== 'idle' ? time + i : 0, blade: m.cable, face: u.face });
      });
      if (u.onWall && card.cannon && u.state !== 'deploy') { /* расчёт стоит у орудий */ }
    } else {
      const z = u.z;
      if (z > 3 && u.state !== 'engage') {
        c.fillStyle = 'rgba(230,230,230,0.4)';
        const ax = u.x + (u.face || 1) * 22, ay = u.y - z - 26;
        for (let k = 0; k < 12; k++) c.fillRect(Math.round(A.lerp(u.x, ax, k / 12)), Math.round(A.lerp(u.y - z - 4, ay, k / 12)), 1, 1);
      }
      if (u.state === 'engage' && u.target && !u.target.dead && !card.range && A.dist(u, u.target) < u.target.def.w * 0.5 + 14) {
        const t = u.target, a = time * 3.2 + u.id;
        const mx = t.x + Math.cos(a) * (t.def.w * 0.55 + 4), my = t.y + Math.sin(a) * 3;
        const mz = t.def.h * 0.75 + Math.sin(a * 2) * 3;
        c.fillStyle = 'rgba(230,230,230,0.6)';
        for (let k = 0; k < 10; k++) c.fillRect(Math.round(A.lerp(mx, t.x, k / 10)), Math.round(A.lerp(my - mz - 4, t.y - t.def.h * 0.88, k / 10)), 1, 1);
        if (card.ability === 'spin') { c.fillStyle = 'rgba(255,255,255,0.5)'; for (let k = 0; k < 8; k++) { const aa = time * 20 + k; c.fillRect(Math.round(mx + Math.cos(aa) * 5), Math.round(my - mz - 3 + Math.sin(aa) * 3), 1, 1); } }
        soldier(c, mx, my - mz, card.color, u.id, { blade: true, face: u.face, hair: heroHair(card) });
      } else {
        soldier(c, u.x, u.y - z, card.color, u.id, { walk: z < 1 && u.state !== 'idle' ? time : 0, face: u.face, hair: heroHair(card), blade: card.ability !== 'archer' && card.ability !== 'marshal' });
        if (card.ability === 'archer') { c.fillStyle = '#7a5532'; c.fillRect(Math.round(u.x) + 2, Math.round(u.y - z) - 7, 1, 5); }
      }
    }
    c.globalAlpha = 1;
  }
  function heroHair(card) {
    return { levi: '#141418', mikasa: '#141418', armin: '#e2c55a', jean: '#8a6a44', connie: '#8a8a8a', sasha: '#6b4426', hange: '#6b4a2c', erwin: '#d9b74a', pyxis: '#d8d0c0', eren: '#3a2a1a' }[card.id];
  }

  function projPos(p) {
    const k = Math.min(1, p.t / p.dur);
    return { x: A.lerp(p.x0, p.x1, k), y: A.lerp(p.y0, p.y1, k), z: A.lerp(p.z0 || 0, p.z1 || 0, k) + (p.arc || 0) * 4 * k * (1 - k), k };
  }
  function drawProjs(c) {
    for (const p of G.projs) {
      const q = projPos(p);
      if (p.kind === 'rock') {
        ell(c, q.x, q.y, 3, 1, 'rgba(0,0,0,0.3)');
        c.fillStyle = '#8a857c'; c.fillRect(Math.round(q.x - 2), Math.round(q.y - q.z - 2), 4, 4);
        c.fillStyle = '#b0aa9e'; c.fillRect(Math.round(q.x - 2), Math.round(q.y - q.z - 2), 2, 1);
      } else if (p.kind === 'ball') {
        c.fillStyle = '#1e1e22'; c.fillRect(Math.round(q.x - 1), Math.round(q.y - q.z - 1), 2, 2);
      } else if (p.kind === 'arrow') {
        c.fillStyle = '#e8e0cc'; c.fillRect(Math.round(q.x - 1), Math.round(q.y - q.z), 3, 1);
      } else if (p.kind === 'spear') {
        c.fillStyle = '#ffb36a'; c.fillRect(Math.round(q.x - 1), Math.round(q.y - q.z - 1), 3, 2);
        c.fillStyle = 'rgba(180,180,180,0.5)'; c.fillRect(Math.round(q.x - 4), Math.round(q.y - q.z), 3, 1);
      }
    }
  }
  function drawFx(c) {
    for (const f of G.fx) {
      const a = f.fade === false ? 1 : Math.max(0, f.life / f.max);
      if (f.flash) {
        c.globalAlpha = a * 0.7; ell(c, f.x, f.y - 15, f.size * (1.5 - a), f.size * 0.7 * (1.5 - a), f.col); continue;
      }
      const s = Math.max(1, Math.round(f.size + f.grow * (1 - a)));
      c.fillStyle = f.col;
      if (s >= 4) { // клубы дыма и пара — пиксельные «облачка» из трёх кругов
        c.globalAlpha = (f.smokeTrail ? 0.35 : 0.55) * a;
        const r = s / 2, X = f.x, Y = f.y - f.z;
        ell(c, X, Y, r, r * 0.8, f.col);
        ell(c, X - r * 0.55, Y + r * 0.25, r * 0.6, r * 0.5, f.col);
        ell(c, X + r * 0.5, Y + r * 0.3, r * 0.55, r * 0.45, f.col);
      } else {
        c.globalAlpha = f.smokeTrail ? a * 0.35 : f.flare ? 1 : a * 0.85;
        c.fillRect(Math.round(f.x - s / 2), Math.round(f.y - f.z - s / 2), s, s);
      }
    }
    c.globalAlpha = 1;
  }

  // ---------- Подписи ----------
  function bar(c, x, y, w, frac, col, bg) {
    c.fillStyle = bg || 'rgba(0,0,0,0.65)'; c.fillRect(Math.round(x - w / 2) - 1, Math.round(y) - 1, w + 2, 5);
    c.fillStyle = col; c.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w * A.clamp(frac, 0, 1)), 3);
  }
  function txt(c, s, x, y, col, size, align, bold) {
    c.font = `${bold ? 700 : 600} ${size || 12}px "Rubik", system-ui, sans-serif`;
    c.textAlign = align || 'center'; c.textBaseline = 'bottom';
    c.lineWidth = 3; c.strokeStyle = 'rgba(10,10,10,0.9)'; c.strokeText(s, x, y);
    c.fillStyle = col; c.fillText(s, x, y);
  }
  // названия мест: чем дальше камера, тем крупнее объекты подписаны
  function drawMapLabels(c) {
    const z = A.cam.z;
    for (const l of A.decor.labels) {
      let show, size;
      if (l.size === 3) { show = z < 0.6; size = 20; }
      else if (l.size === 2) { show = z < 1.6; size = z < 0.6 ? 14 : 16; }
      else { show = z >= 0.4 && z < 3.2; size = 12; }
      if (!show) continue;
      const p = A.worldToScreen(l.x, l.y);
      if (p.x < -200 || p.y < -50 || p.x > A.view.cw + 200 || p.y > A.view.ch + 50) continue;
      txt(c, l.text, p.x, p.y, l.wall ? '#e8dcc0' : l.size === 3 ? '#ffe7a8' : '#fff2c8', size, 'center', l.size >= 2);
      if (l.sub && z >= 0.4) txt(c, l.sub, p.x, p.y + 14, '#d8ccb0', 11);
    }
    // стрелки атаки
    if (G.phase === 'wave' && G.queue && G.queue.dirs) {
      const pulse = 0.6 + Math.sin(performance.now() / 200) * 0.4;
      for (const i of G.queue.dirs) {
        const Dd = A.DISTRICTS[i];
        const p = A.worldToScreen(Dd.gx + Dd.nx * 260, Dd.gy + Dd.ny * 260);
        c.globalAlpha = pulse; txt(c, '▼ ТИТАНЫ', p.x, p.y, '#ff6b5a', 14, 'center', true); c.globalAlpha = 1;
      }
    }
  }

  function drawLabels(c, ents) {
    const z = A.cam.z;
    const hover = A.ui && A.ui.hover;
    for (const e of ents) {
      if (e.dead) continue;
      if (e.kind === 'titan') {
        const p = A.worldToScreen(e.x, e.y - e.def.h - 3);
        const dmg = e.hp < e.maxHp;
        if (e.def.special || (dmg && z >= 0.75) || hover === e) {
          const w = Math.max(18, Math.min(70, e.def.w * z * 1.4));
          bar(c, p.x, p.y - 6, w, e.hp / e.maxHp, e.def.special ? '#e0503a' : '#d8a040');
          if (e.armor > 0) { c.fillStyle = '#9fb4c8'; c.fillRect(Math.round(p.x - w / 2), Math.round(p.y - 9), Math.round(w * e.armor), 2); }
        }
        if (e.def.special || hover === e) {
          const tags = [];
          if (e.armor > 0.5) tags.push('броня'); if (e.steamOn) tags.push('пар'); if (e.hardenT > 0) tags.push('отвердение');
          if (e.rootT > 0) tags.push('скован'); if (e.blindT > 0) tags.push('ослеплён'); if (e.markT > 0) tags.push('помечен');
          if (e.disarmT > 0) tags.push('без рук'); if (e.distractT > 0) tags.push('ослеплён ракетами');
          txt(c, e.def.name + (tags.length ? ' · ' + tags.join(', ') : ''), p.x, p.y - 10, e.def.special ? '#ffb4a8' : '#f0e0c0', 11);
        }
      } else {
        if (e.state === 'safe') continue;
        const isHero = e.card.kind === 'hero';
        const showName = A.ui && (A.ui.selected === e || hover === e);
        const titan = e.card.ability === 'shifter' && e.form === 'titan';
        const hy = titan ? 34 : 10 + e.z;
        const p = A.worldToScreen(e.x, e.y - hy);
        if (isHero && (z >= 1.5 || showName)) txt(c, e.card.name.split(' ')[0], p.x, p.y - 2, e.card.color === '#2b2f3a' ? '#cfd8e8' : '#fff2c8', 11);
        else if (!isHero && showName) txt(c, `${e.card.name} (${e.members})`, p.x, p.y - 2, '#e8e0cc', 11);
        if (z >= 1 || showName) {
          if (titan) bar(c, p.x, p.y, 26, e.titanHp / e.titanMax, '#5ad16a');
          else if (e.card.kind === 'squad') { for (let i = 0; i < e.maxMembers; i++) { c.fillStyle = i < e.members ? '#e8e0cc' : 'rgba(0,0,0,0.5)'; c.fillRect(Math.round(p.x - e.maxMembers * 2 + i * 4), Math.round(p.y), 3, 3); } }
          else if (e.card.ability !== 'shifter') { for (let i = 0; i < e.maxHp; i++) { c.fillStyle = i < e.hp ? '#e05a5a' : 'rgba(0,0,0,0.5)'; c.fillRect(Math.round(p.x - e.maxHp * 2 + i * 4), Math.round(p.y), 3, 3); } }
          if (e.heat > 0.05) { bar(c, p.x, p.y - 6, 16, e.heat, '#ff7a3a'); }
          if (!e.card.cannon && !e.card.wallOnly && e.card.ability !== 'shifter' && e.gas < 60) bar(c, p.x, p.y + 5, 14, e.gas / 100, e.gas < 20 ? '#e0503a' : '#7fb8e0');
          if (e.order && ['spear', 'charge', 'flank', 'seal'].includes(e.order.kind)) {
            const lab = { spear: 'копьё', charge: 'атака!', flank: 'фланг', seal: 'валун' }[e.order.kind];
            txt(c, lab, p.x, p.y - 14, '#ffb36a', 10);
          }
        }
      }
    }
  }
  function drawFloaters(c) {
    for (const f of G.floaters) {
      if (!f.text) continue;
      const p = A.worldToScreen(f.x, f.y);
      c.globalAlpha = Math.min(1, f.life / f.max * 2);
      txt(c, f.text, p.x, p.y, f.col, f.big ? 15 : 11);
    }
    c.globalAlpha = 1;
  }
  function drawGhost(c) {
    const m = A.mouse;
    if (!m.inside) return;
    const card = A.CARD[A.ui.deployCard];
    const can = A.canDeploy(card, m.wx, m.wy);
    const z = A.cam.z;
    const r = (card.cannon && can.onWall ? card.cannon.range : card.leash || 40) * z;
    c.strokeStyle = can.ok ? 'rgba(140,240,140,0.7)' : 'rgba(255,90,70,0.8)';
    c.setLineDash([6, 4]); c.lineWidth = 2;
    c.beginPath();
    c.arc(m.x, m.y, r, 0, 7);
    c.stroke(); c.setLineDash([]);
    c.fillStyle = can.ok ? 'rgba(140,240,140,0.9)' : 'rgba(255,90,70,0.9)';
    c.fillRect(m.x - 3, m.y - 3, 6, 6);
    const ti = A.TERRAIN_INFO[A.terrainAt(m.wx, m.wy)];
    const line2 = can.ok ? `${ti.name}: опора для УПМ ${Math.round(ti.anchor * 100)}%` : can.reason;
    txt(c, card.name, m.x + 12, m.y - 16, '#fff2c8', 12, 'left');
    txt(c, line2, m.x + 12, m.y - 2, can.ok ? '#c8f0c0' : '#ffb0a0', 11, 'left');
  }

  // ---------- Мини-карта ----------
  A.renderMini = function (mc, w, h) {
    mc.imageSmoothingEnabled = true;
    mc.drawImage(A.miniBg, 0, 0, w, h);
    const kx = w / W.W, ky = h / W.H;
    for (const t of G.titans) {
      if (t.dead) continue;
      mc.fillStyle = t.def.special ? '#ff3a2a' : '#ffb070';
      const s = t.def.special ? 4 : 2;
      mc.fillRect(t.x * kx - s / 2, t.y * ky - s / 2, s, s);
    }
    for (const u of G.units) {
      if (!A.unitAlive(u)) continue;
      mc.fillStyle = u.card.kind === 'hero' ? '#7fe0ff' : '#e8f0ff';
      mc.fillRect(u.x * kx - 1, u.y * ky - 1, u.card.kind === 'hero' ? 3 : 2, u.card.kind === 'hero' ? 3 : 2);
    }
    mc.strokeStyle = '#ffd45a'; mc.lineWidth = 1;
    mc.strokeRect(A.cam.x * kx + 0.5, A.cam.y * ky + 0.5, A.view.cw / A.cam.z * kx, A.view.ch / A.cam.z * ky);
    if (G.phase === 'wave' && G.queue && G.queue.dirs) for (const i of G.queue.dirs) {
      const Dd = A.DISTRICTS[i]; mc.fillStyle = '#ff3a2a';
      mc.beginPath(); mc.arc((Dd.gx + Dd.nx * 200) * kx, (Dd.gy + Dd.ny * 200) * ky, 5, 0, 7); mc.fill();
    }
  };

  A.pickAt = function (wx, wy) {
    let best = null, bd = 1e9;
    for (const u of G.units) {
      if (!A.unitAlive(u)) continue;
      const titan = u.card.ability === 'shifter' && u.form === 'titan';
      const d = A.distXY(wx, wy, u.x, u.y - (titan ? 14 : u.z + 4));
      const r = titan ? 16 : u.card.kind === 'squad' ? 12 : 8;
      if (d < r && d < bd) { bd = d; best = u; }
    }
    if (best) return best;
    for (const t of G.titans) {
      if (t.dead) continue;
      if (wx > t.x - t.def.w * 0.7 && wx < t.x + t.def.w * 0.7 && wy > t.y - t.def.h - 2 && wy < t.y + 3) {
        const d = Math.abs(wy - (t.y - t.def.h / 2));
        if (d < bd) { bd = d; best = t; }
      }
    }
    return best;
  };
})(window.AOT);
