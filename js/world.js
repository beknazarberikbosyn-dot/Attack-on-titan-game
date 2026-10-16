// Мир: рельеф, опоры для УПМ и генерация огромной пиксельной карты
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const W = A.WORLD;

  // ---------- Рельеф (используется и логикой, и отрисовкой) ----------
  A.riverX = (y) => 1880 + Math.sin(y * 0.0042) * 70 + Math.sin(y * 0.013 + 1.3) * 26;
  const forestN = A.makeNoise(91, 40);
  A.FORESTS = [
    { x: 2480, y: 370, rx: 330, ry: 280, giant: true },
    { x: 2640, y: 1150, rx: 230, ry: 180, giant: true },
    { x: 1230, y: 1180, rx: 120, ry: 85, giant: false },
  ];
  A.forestVal = function (x, y) {
    let best = 9;
    for (const f of A.FORESTS) {
      const e = ((x - f.x) / f.rx) ** 2 + ((y - f.y) / f.ry) ** 2 + (forestN(x, y) - 0.5) * 0.6;
      if (e < best) best = e;
    }
    return best;
  };
  A.inForest = (x, y) => A.forestVal(x, y) < 1;
  A.VILLAGE = { x0: 1440, y0: 990, x1: 1730, y1: 1265 };
  A.inVillage = (x, y) => x > A.VILLAGE.x0 && x < A.VILLAGE.x1 && y > A.VILLAGE.y0 && y < A.VILLAGE.y1;
  A.inRiver = (x, y) => Math.abs(x - A.riverX(y)) < 16;

  A.TERRAIN_INFO = {
    town: { name: 'Город за стеной', anchor: 1, note: 'Крыши и шпили — отличные опоры для тросов' },
    wall: { name: 'Стена Роза', anchor: 1, note: 'Безопасно от обычных титанов' },
    nearwall: { name: 'Подножие стены', anchor: 0.95, note: 'Тросы цепляются за стену' },
    forest: { name: 'Лес гигантских деревьев', anchor: 1, note: 'Идеально для УПМ' },
    village: { name: 'Руины деревни', anchor: 0.85, note: 'Невысокие дома — опор немного' },
    river: { name: 'Река', anchor: 0.5, note: 'Открыто, вязкий берег' },
    field: { name: 'Открытое поле', anchor: 0.55, note: 'Тросам не за что цепляться — урон и уклонение ниже' },
  };
  A.terrainAt = function (x, y) {
    if (x < W.wallX) return 'town';
    if (x <= W.wallX + W.wallW) return 'wall';
    if (x < W.wallX + W.wallW + 130) return 'nearwall';
    if (A.inForest(x, y)) return 'forest';
    if (A.inVillage(x, y)) return 'village';
    if (A.inRiver(x, y)) return 'river';
    return 'field';
  };
  A.anchorAt = (x, y) => A.TERRAIN_INFO[A.terrainAt(x, y)].anchor;

  A.SUPPLY = [
    { x: W.wallX - 26, y: 300 },
    { x: W.wallX - 26, y: W.gateY },
    { x: W.wallX - 26, y: 1100 },
  ];
  A.BOULDER = { x: W.wallX - 150, y: W.gateY - 205 };
  A.GATE = { x: W.wallX + W.wallW, y: W.gateY };

  // Дороги (ломаные)
  A.ROADS = [
    // главная дорога от ворот на восток
    [[W.wallX + W.wallW, W.gateY], [1150, 726], [1400, 700], [1650, 690], [1880, 705], [2100, 740], [2400, 760], [2700, 720], [3000, 690], [3200, 700]],
    // на север к мельнице и лесу
    [[1250, 712], [1270, 600], [1300, 470], [1330, 400], [1500, 330], [1800, 300], [2100, 330]],
    // на юг к деревне
    [[1420, 702], [1460, 820], [1520, 940], [1580, 1050], [1600, 1130]],
  ];

  // ---------- Генерация карты ----------
  A.generateWorld = function () {
    const r = A.rng(20260416);
    const ri = (a, b) => Math.floor(a + r() * (b - a + 1));
    const rf = (a, b) => a + r() * (b - a);

    const cv = document.createElement('canvas');
    cv.width = W.W; cv.height = W.H;
    const c = cv.getContext('2d');
    const decor = {
      chimneys: [], flags: [], ripples: [], cannons: [], streetsH: [], streetsV: [],
      windmill: null, lamps: [], torches: [],
    };

    // ===== 1. Базовый слой по пикселям =====
    const img = c.createImageData(W.W, W.H);
    const d = img.data;
    const nLarge = A.makeNoise(7, 90), nMid = A.makeNoise(13, 22);
    // грубая сетка шума, чтобы было быстро
    const S = 4, gw = Math.ceil(W.W / S) + 1, gh = Math.ceil(W.H / S) + 1;
    const gL = new Float32Array(gw * gh), gM = new Float32Array(gw * gh), gF = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const x = gx * S, y = gy * S, k = gy * gw + gx;
      gL[k] = nLarge(x, y); gM[k] = nMid(x, y);
      gF[k] = x > W.wallX + W.wallW ? A.forestVal(x, y) : 9;
    }
    const riverXs = new Float32Array(W.H);
    for (let y = 0; y < W.H; y++) riverXs[y] = A.riverX(y);

    for (let y = 0; y < W.H; y++) {
      const rx = riverXs[y];
      for (let x = 0; x < W.W; x++) {
        const k = ((y / S) | 0) * gw + ((x / S) | 0);
        const h = A.hash(x, y, 3);
        let R, G, B;
        if (x < W.wallX) {
          // земля города: утоптанная земля / дворы
          const v = gM[k];
          R = 120 + v * 26; G = 110 + v * 22; B = 92 + v * 16;
          if (h < 0.08) { R -= 18; G -= 18; B -= 16; } else if (h > 0.95) { R += 14; G += 12; B += 10; }
          // травка во дворах
          if (gL[k] > 0.62 && h > 0.4) { R = 96 + v * 20; G = 128 + v * 20; B = 70; }
        } else {
          const dr = Math.abs(x - rx);
          const fv = gF[k];
          if (dr < 15) {
            const deep = dr < 8;
            R = deep ? 46 : 60; G = deep ? 90 : 108; B = deep ? 130 : 148;
            if (h > 0.985) { R = 150; G = 196; B = 220; }
          } else if (dr < 19) {
            R = 190 + h * 14; G = 172 + h * 12; B = 124 + h * 10;
          } else if (fv < 1) {
            // лесная подстилка
            const v = gM[k];
            R = 50 + v * 18; G = 76 + v * 22; B = 40 + v * 10;
            if (h < 0.1) { R = 92; G = 76; B = 44; } else if (h > 0.97) { R = 120; G = 96; B = 52; }
          } else {
            // луга: сочная/сухая трава, оттенки
            const L = gL[k], M = gM[k];
            const dry = A.clamp((L - 0.45) * 2.2, 0, 1);
            R = 82 + dry * 52 + M * 14; G = 132 + dry * 18 + M * 16; B = 58 + dry * 10 + M * 6;
            if (fv < 1.35) { R -= 14; G -= 10; B -= 6; } // тень от опушки
            if (h < 0.07) { R -= 22; G -= 26; B -= 16; }
            else if (h > 0.93) { R += 18; G += 22; B += 12; }
            // цветы
            if (h > 0.9985) { const f = A.hash(x, y, 9); if (f < 0.33) { R = 230; G = 220; B = 90; } else if (f < 0.66) { R = 236; G = 236; B = 236; } else { R = 200; G = 90; B = 150; } }
          }
        }
        const i = (y * W.W + x) * 4;
        d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);

    // ===== Помощники рисования =====
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
    const sh = A.shade;
    function disc(cx, cy, rad, col, light, speck) {
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const q = dx * dx + dy * dy;
        if (q > rad * rad + rad * 0.6) continue;
        let k = 1;
        if (light) { const l = (-dx - dy) / (rad * 2); k = 0.82 + l * 0.45; }
        if (speck && A.hash(cx + dx, cy + dy, 21) > 0.86) k *= 0.8;
        if (speck && A.hash(cx + dx, cy + dy, 22) > 0.95) k *= 1.2;
        c.fillStyle = sh(col, k);
        c.fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
    function shadowEll(cx, cy, rx, ry, a) {
      c.fillStyle = `rgba(20,24,16,${a})`;
      for (let dy = -ry; dy <= ry; dy++) {
        const w = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry + 0.01)));
        c.fillRect(cx - w, cy + dy, w * 2, 1);
      }
    }
    function stampPath(pts, rad, col, edge, ruts) {
      for (let p = 0; p < pts.length - 1; p++) {
        const [x1, y1] = pts[p], [x2, y2] = pts[p + 1];
        const L = Math.hypot(x2 - x1, y2 - y1);
        for (let s = 0; s <= L; s += 1.5) {
          const x = x1 + (x2 - x1) * (s / L), y = y1 + (y2 - y1) * (s / L);
          if (edge) px(x - rad - 1, y - rad - 1, rad * 2 + 2, rad * 2 + 2, edge);
        }
      }
      for (let p = 0; p < pts.length - 1; p++) {
        const [x1, y1] = pts[p], [x2, y2] = pts[p + 1];
        const L = Math.hypot(x2 - x1, y2 - y1);
        for (let s = 0; s <= L; s += 1.5) {
          const x = x1 + (x2 - x1) * (s / L), y = y1 + (y2 - y1) * (s / L);
          px(x - rad, y - rad, rad * 2, rad * 2, col);
          if (ruts) {
            const nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
            px(x + nx * 3, y + ny * 3, 1, 1, ruts);
            px(x - nx * 3, y - ny * 3, 1, 1, ruts);
          }
          if (A.hash(x | 0, y | 0, 5) > 0.93) px(x + rf(-rad, rad), y + rf(-rad, rad), 1, 1, sh(col, 0.85));
        }
      }
    }

    function tree(cx, cy, rad, col) {
      shadowEll(cx + rad * 0.6, cy + 2, rad, Math.max(2, rad * 0.45) | 0, 0.28);
      px(cx - 1, cy - 2, 2, 4, '#5a3d24');
      disc(cx, cy - rad - 1, rad, col || '#4f8a3a', true, true);
    }
    function bush(cx, cy) {
      shadowEll(cx + 2, cy + 1, 4, 2, 0.25);
      disc(cx, cy - 2, 3, A.pick(['#4a7d35', '#5d8f3e', '#3f6e30']), true, true);
      if (r() < 0.3) px(cx - 1, cy - 3, 1, 1, '#c84a4a');
    }
    function rock(cx, cy, s) {
      shadowEll(cx + s * 0.5, cy + 1, s, Math.max(1, s * 0.4) | 0, 0.3);
      disc(cx, cy - s * 0.5 | 0, s, '#8d8b85', true, true);
    }
    function giantTree(cx, cy) {
      const tw = ri(10, 16), th = ri(44, 76);
      shadowEll(cx + 30, cy + 4, 46, 14, 0.32);
      // корни
      px(cx - tw / 2 - 3, cy - 3, tw + 6, 4, '#4a3420');
      // ствол
      for (let i = 0; i < tw; i++) {
        const k = 0.75 + (i / tw) * 0.45;
        c.fillStyle = sh('#6b4a2c', i < tw * 0.3 ? 0.78 : k);
        c.fillRect(cx - tw / 2 + i, cy - th, 1, th);
      }
      for (let y = cy - th; y < cy; y += 3) if (r() < 0.5) px(cx - tw / 2 + ri(1, tw - 2), y, 1, ri(2, 5), '#3f2b19');
      // крона
      const n = ri(4, 6);
      for (let i = 0; i < n; i++) {
        disc(cx + ri(-26, 26), cy - th - ri(-6, 22), ri(16, 28), A.pick(['#2f5a2a', '#36662e', '#2a5226', '#3d6f33']), true, true);
      }
      // ветки с площадками для тросов
      if (r() < 0.6) px(cx + tw / 2, cy - th * 0.55, ri(10, 18), 2, '#5a3d24');
    }
    function fence(x1, y1, x2, y2) {
      const L = Math.hypot(x2 - x1, y2 - y1);
      for (let s = 0; s <= L; s += 1) {
        const x = x1 + (x2 - x1) * s / L, y = y1 + (y2 - y1) * s / L;
        px(x, y - 3, 1, 1, '#8a6a44');
        px(x, y - 1, 1, 1, '#7a5a38');
        if ((s | 0) % 6 === 0) px(x, y - 4, 1, 5, '#5f4428');
      }
    }
    function hay(x, y) {
      shadowEll(x + 3, y + 1, 6, 2, 0.25);
      for (let dy = 0; dy < 6; dy++) {
        const w = 10 - Math.abs(dy - 2) * 1.6;
        px(x - w / 2, y - 6 + dy, w, 1, dy < 2 ? '#e3c76a' : dy < 4 ? '#d4b356' : '#b8963f');
      }
      px(x - 2, y - 4, 1, 1, '#a88534');
    }
    function cart(x, y) {
      shadowEll(x + 4, y + 2, 7, 2, 0.25);
      px(x - 6, y - 5, 12, 4, '#7d5631');
      px(x - 6, y - 5, 12, 1, '#9b6e40');
      px(x - 5, y - 1, 3, 3, '#3b2a1a'); px(x + 3, y - 1, 3, 3, '#3b2a1a');
      px(x + 6, y - 3, 6, 1, '#6a4a2a');
      if (r() < 0.5) { px(x - 4, y - 8, 4, 3, '#d4b356'); px(x, y - 7, 4, 2, '#8a3a2a'); }
    }
    function barrel(x, y) { px(x, y - 4, 3, 4, '#7a5532'); px(x, y - 3, 3, 1, '#4a3420'); px(x, y - 4, 3, 1, '#9b7044'); }
    function crate(x, y) { px(x, y - 4, 4, 4, '#a07a48'); px(x, y - 4, 4, 1, '#c09460'); px(x + 1, y - 3, 2, 2, '#7d5a32'); }

    function house(x, y, w, h, opts) {
      opts = opts || {};
      const roofs = ['#9e4a35', '#8b3f2f', '#6c6f7d', '#5b6170', '#a8683c', '#7a4b3a', '#4f5a68'];
      const walls = ['#e2d6bc', '#d8c8a6', '#cfc2a8', '#e8dfca', '#c9b48e'];
      const roof = opts.roof || A.pick(roofs), wallC = opts.wall || A.pick(walls);
      const wallH = Math.max(6, Math.round(h * 0.38)), roofH = h - wallH;
      c.fillStyle = 'rgba(25,22,18,0.33)'; c.fillRect(x + 3, y + 3, w, h);
      // крыша
      px(x, y, w, roofH, roof);
      px(x, y, w, Math.floor(roofH / 2), sh(roof, 0.8));
      for (let yy = y + 2; yy < y + roofH - 1; yy += 3) px(x, yy, w, 1, sh(roof, yy < y + roofH / 2 ? 0.7 : 0.88));
      for (let yy = y; yy < y + roofH; yy += 3) for (let xx = x + ((yy / 3) % 2 ? 0 : 2); xx < x + w; xx += 4) px(xx, yy, 1, 2, sh(roof, 0.9));
      px(x, y + Math.floor(roofH / 2), w, 1, sh(roof, 1.18));
      px(x, y + roofH - 1, w, 1, sh(roof, 0.55));
      if (opts.ruined) {
        const hx = x + ri(2, w - 8), hy = y + ri(1, Math.max(2, roofH - 6));
        px(hx, hy, ri(4, 8), ri(3, 5), '#2a2420');
        px(hx + 1, hy + 1, 2, 1, '#6a5a48');
      }
      // фасад
      px(x, y + roofH, w, wallH, wallC);
      px(x, y + roofH, 1, wallH, sh(wallC, 0.7)); px(x + w - 1, y + roofH, 1, wallH, sh(wallC, 0.75));
      if (r() < 0.5) { // фахверк
        px(x, y + roofH + 1, w, 1, '#5a3d24');
        for (let xx = x + 5; xx < x + w - 2; xx += 7) px(xx, y + roofH + 1, 1, wallH - 1, '#5a3d24');
      }
      const door = x + ri(2, Math.max(2, w - 5));
      for (let xx = x + 2; xx < x + w - 3; xx += 6) {
        if (Math.abs(xx - door) < 4) continue;
        const lit = r() < 0.25;
        px(xx, y + roofH + 2, 2, 3, opts.ruined ? '#1e1a16' : lit ? '#f2d27a' : '#33414f');
        if (!opts.ruined && r() < 0.3) px(xx - 1, y + roofH + 5, 4, 1, A.pick(['#c84a4a', '#d9c050', '#c86fb0']));
      }
      px(door, y + h - 5, 3, 5, opts.ruined ? '#1e1a16' : '#5a3a20');
      if (!opts.ruined && r() < 0.75) {
        const cx = x + ri(2, w - 5), cy = y + ri(1, Math.max(1, roofH - 6));
        px(cx, cy, 3, 5, '#77706a'); px(cx, cy, 3, 1, '#4a4440');
        decor.chimneys.push({ x: cx + 1, y: cy, ph: r() * 10 });
      }
      if (opts.ruined) for (let i = 0; i < 6; i++) px(x + ri(-3, w + 2), y + h + ri(0, 4), ri(1, 3), ri(1, 2), A.pick(['#8a7f70', '#6d6458', '#a39784']));
    }

    // ===== 2. Город =====
    const streetsX = [70, 220, 370, 520, 670, 820];
    const streetsY = [60, 180, 300, 430, 570, W.gateY, 870, 1000, 1120, 1240, 1355];
    const cobble = (x, y, w, h, base) => {
      px(x, y, w, h, base);
      for (let yy = y; yy < y + h; yy += 2) for (let xx = x + ((yy >> 1) % 2); xx < x + w; xx += 3) {
        if (A.hash(xx, yy, 77) > 0.55) px(xx, yy, 2, 1, sh(base, 0.86));
      }
    };
    for (const sx of streetsX) { cobble(sx - 6, 0, 12, W.H, '#9a917f'); decor.streetsV.push(sx); }
    for (const sy of streetsY) {
      const ww = sy === W.gateY ? 28 : 12;
      cobble(0, sy - ww / 2, W.wallX, ww, sy === W.gateY ? '#a69c88' : '#9a917f');
      decor.streetsH.push(sy);
    }
    // фонари вдоль главной улицы
    for (let x = 30; x < W.wallX - 20; x += 46) {
      for (const s of [-16, 16]) {
        const y = W.gateY + s;
        px(x, y - 9, 1, 9, '#2d2a28'); px(x - 1, y - 11, 3, 2, '#f0d27a');
        decor.lamps.push({ x, y: y - 10 });
      }
    }
    // кварталы
    for (let ix = 0; ix < streetsX.length - 1; ix++) {
      for (let iy = 0; iy < streetsY.length - 1; iy++) {
        const bx0 = streetsX[ix] + 7, bx1 = streetsX[ix + 1] - 7;
        const ty = streetsY[iy] + (streetsY[iy] === W.gateY ? 15 : 7);
        const by = streetsY[iy + 1] - (streetsY[iy + 1] === W.gateY ? 15 : 7);
        const bh = by - ty;
        // площадь с рынком
        if (ix === 2 && (iy === 4 || iy === 5)) {
          cobble(bx0, ty, bx1 - bx0, bh, '#b3a891');
          if (iy === 5) {
            const fx = (bx0 + bx1) / 2 | 0, fy = ty + 26;
            disc(fx, fy, 9, '#8d8b85', true, false); disc(fx, fy, 6, '#4f86a8', false, false);
            px(fx - 1, fy - 6, 2, 6, '#c8c4bc');
          }
          for (let k = 0; k < 6; k++) {
            const sx = bx0 + 8 + k * 23, sy = iy === 4 ? by - 16 : ty + 52;
            if (sx > bx1 - 18) break;
            const aw = A.pick(['#c84a4a', '#3d6fa8', '#d9b74a', '#5a8a46']);
            for (let i = 0; i < 16; i++) px(sx + i, sy, 1, 5, i % 4 < 2 ? aw : '#efe6d0');
            px(sx, sy + 5, 16, 4, '#8a6640');
            px(sx + 2, sy + 4, 2, 1, '#d84a3a'); px(sx + 6, sy + 4, 3, 1, '#e3c76a'); px(sx + 11, sy + 4, 2, 1, '#6fa046');
            barrel(sx + 17, sy + 10); crate(sx - 5, sy + 10);
          }
          continue;
        }
        // церковь
        if (ix === 1 && iy === 2) {
          cobble(bx0, ty, bx1 - bx0, bh, '#a69c88');
          const cx0 = bx0 + 30, cy0 = ty + 22;
          house(cx0, cy0, 70, 60, { roof: '#4f5a68', wall: '#d6ccb8' });
          px(cx0 + 28, cy0 - 30, 14, 44, '#cfc4ae'); px(cx0 + 28, cy0 - 30, 14, 2, '#4f5a68');
          px(cx0 + 31, cy0 - 40, 8, 10, '#4f5a68'); px(cx0 + 34, cy0 - 48, 2, 8, '#3a404a');
          px(cx0 + 32, cy0 - 22, 6, 6, '#2a2f38'); px(cx0 + 34, cy0 - 20, 2, 2, '#c9a24a');
          for (let k = 0; k < 6; k++) tree(bx0 + 10 + k * 22, by - 4, 5);
          continue;
        }
        // казармы и плац
        if (ix === 4 && (iy === 7 || iy === 8)) {
          px(bx0, ty, bx1 - bx0, bh, '#a8986f');
          if (iy === 7) {
            house(bx0 + 6, ty + 6, bx1 - bx0 - 12, 40, { roof: '#6c4a34', wall: '#cbb894' });
            for (let k = 0; k < 6; k++) { const x = bx0 + 18 + k * 20, y = by - 12; px(x, y - 8, 2, 8, '#6b4a2c'); px(x - 2, y - 6, 6, 2, '#8a6640'); px(x, y - 11, 2, 3, '#d8c49a'); }
          } else {
            for (let k = 0; k < 4; k++) { // конюшня и лошади
              const x = bx0 + 14 + k * 28, y = ty + 30;
              px(x, y - 4, 10, 3, A.pick(['#6b4426', '#3b2a1a', '#8a5a34', '#c8b8a0'])); px(x + 9, y - 7, 2, 4, '#5a3a20');
              px(x + 1, y - 1, 1, 2, '#2a1e14'); px(x + 8, y - 1, 1, 2, '#2a1e14');
            }
            fence(bx0 + 4, ty + 42, bx1 - 4, ty + 42);
            for (let k = 0; k < 5; k++) hay(bx0 + 20 + k * 22, by - 8);
          }
          continue;
        }
        // парк
        if ((ix === 0 && iy === 8) || (ix === 3 && iy === 1)) {
          px(bx0, ty, bx1 - bx0, bh, '#5f9444');
          for (let k = 0; k < 14; k++) tree(ri(bx0 + 6, bx1 - 6), ri(ty + 14, by - 2), ri(4, 7));
          for (let k = 0; k < 6; k++) bush(ri(bx0 + 4, bx1 - 4), ri(ty + 4, by - 2));
          continue;
        }
        // обычные дома: два ряда
        const rows = bh > 90 ? 2 : 1;
        for (let rr = 0; rr < rows; rr++) {
          const hh = rows === 2 ? Math.min(40, (bh / 2 - 4) | 0) : Math.min(44, bh - 6);
          const yy = rr === 0 ? ty + 2 : by - hh - 1;
          let x = bx0 + 1;
          while (x < bx1 - 14) {
            const w = Math.min(ri(16, 34), bx1 - x - 1);
            if (w < 12) break;
            house(x, yy, w, hh - ri(0, 6));
            x += w + ri(1, 4);
          }
          if (rows === 2) {
            // дворик
            const my = (ty + by) / 2 | 0;
            if (r() < 0.6) tree(ri(bx0 + 6, bx1 - 6), my + 4, ri(3, 5));
            if (r() < 0.5) { // бельевая верёвка
              const lx = ri(bx0 + 6, bx1 - 30);
              px(lx, my - 2, 24, 1, '#5a5048');
              for (let k = 0; k < 5; k++) px(lx + 2 + k * 5, my - 1, 3, 3, A.pick(['#efe6d0', '#c84a4a', '#6f8ab8', '#e3c76a']));
            }
            if (r() < 0.5) barrel(ri(bx0 + 2, bx1 - 4), my + 6);
            if (r() < 0.3) cart(ri(bx0 + 10, bx1 - 10), my + 8);
          }
        }
      }
    }
    // плац у стены
    px(826, 0, W.wallX - 826, W.H, '#8f856f');
    for (let y = 0; y < W.H; y += 2) for (let x = 826; x < W.wallX; x += 3) if (A.hash(x, y, 31) > 0.9) px(x, y, 1, 1, '#7d7462');
    // склады снабжения
    for (const s of A.SUPPLY) {
      px(s.x - 50, s.y - 26, 46, 52, '#9e9178');
      px(s.x - 48, s.y - 22, 20, 14, '#cfc2a0'); px(s.x - 48, s.y - 22, 20, 2, '#a4987a'); // палатка
      for (let k = 0; k < 6; k++) crate(s.x - 44 + (k % 3) * 5, s.y + 6 + Math.floor(k / 3) * 5);
      for (let k = 0; k < 8; k++) { // баллоны с газом
        const gx = s.x - 22 + (k % 4) * 4, gy = s.y - 4 + Math.floor(k / 4) * 9;
        px(gx, gy - 6, 3, 6, '#b8c0c8'); px(gx, gy - 6, 1, 6, '#e6ecf0'); px(gx, gy - 7, 3, 1, '#6a737c');
      }
      for (let k = 0; k < 4; k++) { // связки клинков
        px(s.x - 46 + k * 4, s.y - 4, 1, 7, '#d8dee4'); px(s.x - 46 + k * 4, s.y + 3, 1, 2, '#4a4440');
      }
      px(s.x - 8, s.y - 20, 1, 14, '#5a4a38'); px(s.x - 7, s.y - 20, 8, 5, '#c9a24a'); // флажок склада
      decor.flags.push({ x: s.x - 7, y: s.y - 20, col: '#c9a24a' });
    }
    // валун для пролома
    shadowEll(A.BOULDER.x + 8, A.BOULDER.y + 4, 22, 7, 0.35);
    disc(A.BOULDER.x, A.BOULDER.y - 10, 18, '#8a857c', true, true);
    for (let k = 0; k < 8; k++) px(A.BOULDER.x + ri(-12, 12), A.BOULDER.y - 10 + ri(-10, 10), ri(2, 4), 1, '#6d685f');

    // ===== 3. Снаружи стены =====
    // поля (с бороздами)
    const fieldKinds = [
      { base: '#d8b75a', row: '#b8953e' }, { base: '#7aa344', row: '#5f8a34' },
      { base: '#7a5a3a', row: '#5f442a' }, { base: '#a7b84e', row: '#889a3a' }, { base: '#c9a95a', row: '#e0c878' },
    ];
    const fields = [];
    for (let k = 0; k < 26; k++) {
      const x = ri(1060, 1760), y = ri(60, 1340), w = ri(60, 140), h = ri(40, 100);
      if (x + w > A.riverX(y) - 30 || A.inVillage(x + w / 2, y + h / 2) || A.inForest(x + w / 2, y + h / 2)) continue;
      if (Math.abs(y + h / 2 - W.gateY) < 60) continue;
      if (fields.some((f) => x < f.x + f.w + 6 && x + w + 6 > f.x && y < f.y + f.h + 6 && y + h + 6 > f.y)) continue;
      fields.push({ x, y, w, h });
      const fk = A.pick(fieldKinds);
      px(x, y, w, h, fk.base);
      for (let yy = y + 1; yy < y + h; yy += 3) px(x, yy, w, 1, fk.row);
      for (let i = 0; i < w * h / 60; i++) px(x + ri(0, w - 1), y + ri(0, h - 1), 1, 1, sh(fk.base, A.pick([0.8, 1.15])));
      fence(x, y, x + w, y); fence(x, y + h, x + w, y + h);
      for (let yy = y; yy < y + h; yy += 1) { px(x, yy, 1, 1, '#7a5a38'); px(x + w, yy, 1, 1, '#7a5a38'); }
      if (fk.base === '#d8b75a' || fk.base === '#c9a95a') for (let i = 0; i < 3; i++) hay(x + ri(8, w - 8), y + ri(10, h - 4));
    }
    // дороги
    for (const road of A.ROADS) stampPath(road, 6, '#a58a5e', '#8a7350', '#8a7048');
    // мост через реку
    {
      const by = 705, bx = A.riverX(by);
      px(bx - 26, by - 9, 52, 18, '#7d5631');
      for (let x = bx - 26; x < bx + 26; x += 3) px(x, by - 9, 1, 18, '#5f4024');
      px(bx - 26, by - 10, 52, 2, '#4a3220'); px(bx - 26, by + 8, 52, 2, '#4a3220');
      for (let x = bx - 26; x <= bx + 26; x += 8) { px(x, by - 13, 2, 4, '#4a3220'); px(x, by + 9, 2, 4, '#4a3220'); }
    }
    // фермы, мельница
    const farms = [[1180, 470], [1360, 560], [1120, 940], [1340, 880], [1700, 460], [1650, 1350], [1100, 250], [1500, 180]];
    for (const [fx, fy] of farms) {
      house(fx, fy, ri(26, 36), ri(24, 30), { roof: A.pick(['#8b3f2f', '#a8683c', '#7a4b3a']) });
      px(fx + 40, fy + 8, 22, 18, '#8a6640'); px(fx + 40, fy + 8, 22, 8, '#6c4a34'); // сарай
      hay(fx - 10, fy + 26); cart(fx + 30, fy + 34);
      for (let k = 0; k < 3; k++) { const ax = fx + ri(-20, 60), ay = fy + ri(36, 60); px(ax, ay - 3, 4, 2, '#e8e2d6'); px(ax + 3, ay - 4, 1, 2, '#e8e2d6'); }
    }
    {
      const mx = 1330, my = 390;
      shadowEll(mx + 10, my + 3, 16, 5, 0.3);
      for (let i = 0; i < 16; i++) px(mx - 8 + i, my - 30, 1, 30, sh('#cfc4ae', 0.75 + i / 32));
      for (let i = 0; i < 10; i++) px(mx - 8 + i * 0.8 + 1, my - 40 + i, 16 - i * 1.6, 1, '#6c4a34');
      px(mx - 2, my - 6, 4, 6, '#5a3a20'); px(mx - 5, my - 22, 2, 3, '#33414f'); px(mx + 3, my - 22, 2, 3, '#33414f');
      decor.windmill = { x: mx, y: my - 32 };
    }
    // руины деревни
    {
      const V = A.VILLAGE;
      for (let k = 0; k < 18; k++) {
        const x = ri(V.x0 + 6, V.x1 - 40), y = ri(V.y0 + 6, V.y1 - 34);
        house(x, y, ri(18, 32), ri(18, 28), { ruined: true, roof: A.pick(['#6b4a3a', '#5b5f68', '#7a5a42']), wall: A.pick(['#b8ac94', '#a89c84']) });
      }
      for (let k = 0; k < 40; k++) px(ri(V.x0, V.x1), ri(V.y0, V.y1), ri(1, 3), 1, A.pick(['#8a7f70', '#6d6458']));
      const wx = (V.x0 + V.x1) / 2 | 0, wy = (V.y0 + V.y1) / 2 | 0;
      disc(wx, wy, 5, '#8d8b85', true, false); disc(wx, wy, 3, '#2a3a48', false, false); // колодец
      for (let k = 0; k < 5; k++) cart(ri(V.x0, V.x1), ri(V.y0, V.y1));
    }
    // одиночные деревья, кусты, камни на лугах
    for (let k = 0; k < 520; k++) {
      const x = ri(W.wallX + W.wallW + 40, W.W - 10), y = ri(10, W.H - 10);
      if (A.inForest(x, y) || Math.abs(x - A.riverX(y)) < 26 || A.inVillage(x, y)) continue;
      if (fields.some((f) => x > f.x - 4 && x < f.x + f.w + 4 && y > f.y - 4 && y < f.y + f.h + 8)) continue;
      const t = r();
      if (t < 0.38) tree(x, y, ri(3, 7), A.pick(['#4f8a3a', '#5d9a40', '#467d34', '#6a8f3a']));
      else if (t < 0.8) bush(x, y);
      else rock(x, y, ri(2, 5));
    }
    // камыш и кусты вдоль реки
    for (let y = 6; y < W.H; y += ri(4, 12)) {
      const x = A.riverX(y) + (r() < 0.5 ? -1 : 1) * ri(18, 26);
      if (Math.abs(y - 705) < 16) continue;
      if (r() < 0.5) bush(x, y); else { px(x, y - 4, 1, 4, '#5f7a3a'); px(x + 2, y - 5, 1, 5, '#6f8a42'); px(x + 2, y - 6, 1, 1, '#7a5532'); }
    }
    for (let y = 2; y < W.H; y += 5) decor.ripples.push({ x: A.riverX(y) + rf(-11, 11), y, ph: r() * 6.28 });
    // леса гигантских деревьев (сортировка по y для правильного перекрытия)
    const trees = [];
    for (const f of A.FORESTS) {
      const n = f.giant ? Math.round(f.rx * f.ry / 1500) : 30;
      for (let k = 0; k < n; k++) {
        const x = f.x + rf(-f.rx, f.rx), y = f.y + rf(-f.ry, f.ry);
        if (!A.inForest(x, y)) continue;
        trees.push({ x: x | 0, y: y | 0, g: f.giant });
      }
    }
    trees.sort((a, b) => a.y - b.y);
    for (const t of trees) { if (t.g) giantTree(t.x, t.y); else tree(t.x, t.y, ri(6, 10), '#3f7a34'); }

    // ===== 4. Стена Роза =====
    const wx0 = W.wallX, wx1 = W.wallX + W.wallW;
    // тень на внешней стороне — стена высокая
    for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(15,18,12,${0.42 * (1 - i / 26)})`; c.fillRect(wx1 + i, 0, 1, W.H); }
    for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(15,18,12,${0.3 * (1 - i / 6)})`; c.fillRect(wx0 - 1 - i, 0, 1, W.H); }
    // кладка
    for (let y = 0; y < W.H; y++) {
      const row = (y / 5) | 0;
      for (let x = wx0; x < wx1; x++) {
        const off = row % 2 ? 4 : 0;
        const mortar = y % 5 === 0 || (x - wx0 + off) % 9 === 0;
        const tint = A.hash(((x - wx0 + off) / 9) | 0, row, 41);
        const k = mortar ? 0.72 : 0.92 + tint * 0.16;
        c.fillStyle = sh('#aa9f8a', k * (x < wx0 + 3 ? 0.82 : 1));
        c.fillRect(x, y, 1, 1);
      }
    }
    // дорожка по верху и зубцы
    px(wx0 + 6, 0, 2, W.H, '#8a806c');
    for (let y = 0; y < W.H; y += 7) { px(wx1 - 5, y, 5, 4, '#bfb49e'); px(wx1 - 5, y + 4, 5, 3, '#7d7462'); }
    // ворота
    {
      const gy0 = W.gateY - W.gateH / 2;
      px(wx0 - 4, gy0 - 6, W.wallW + 26, W.gateH + 12, '#9a8f7a');
      for (let y = gy0 - 6; y < gy0 + W.gateH + 6; y += 5) px(wx0 - 4, y, W.wallW + 26, 1, '#7d7462');
      px(wx1 + 4, gy0 + 8, 18, W.gateH - 16, '#1f1c1a');
      for (let x = wx1 + 6; x < wx1 + 22; x += 3) px(x, gy0 + 8, 1, W.gateH - 16, '#5a5650');
      for (let y = gy0 + 12; y < gy0 + W.gateH - 8; y += 6) px(wx1 + 4, y, 18, 1, '#5a5650');
      px(wx0 - 4, gy0 - 6, W.wallW + 26, 2, '#cfc4ae');
      px(wx0 + 8, gy0 + 4, 2, W.gateH - 8, '#c9a24a'); // цепь подъёмника
    }
    // башни
    for (let y = 140; y < W.H; y += 280) {
      if (Math.abs(y - W.gateY) < 90) continue;
      px(wx0 - 10, y - 18, W.wallW + 20, 36, '#a0957f');
      for (let yy = y - 18; yy < y + 18; yy += 5) px(wx0 - 10, yy, W.wallW + 20, 1, '#857b67');
      px(wx0 - 6, y - 22, W.wallW + 12, 12, '#4f5a68'); px(wx0 - 6, y - 22, W.wallW + 12, 3, '#3a414c');
      px(wx0 + W.wallW / 2 - 1, y - 34, 1, 12, '#3a3a3a');
      decor.flags.push({ x: wx0 + W.wallW / 2, y: y - 34, col: '#8e3b2f' });
    }
    // пушки на рельсах
    for (let y = 40; y < W.H - 20; y += 64) {
      if (Math.abs(y - W.gateY) < 50) continue;
      px(wx0 + 14, y - 1, wx1 - wx0 - 18, 1, '#5a5650');
      px(wx1 - 16, y - 4, 8, 6, '#6b4a2c'); px(wx1 - 16, y - 4, 8, 1, '#8a6640');
      px(wx1 - 10, y - 3, 9, 3, '#2a2a2e'); px(wx1 - 10, y - 3, 9, 1, '#55555c');
      for (let k = 0; k < 3; k++) px(wx1 - 24 + k * 2, y + 2, 2, 2, '#2a2a2e');
      decor.cannons.push({ x: wx1 - 1, y: y - 2 });
    }

    // ===== 5. Подготовка анимаций =====
    // жители города бродят по улицам
    decor.people = [];
    for (let k = 0; k < 170; k++) {
      const horiz = r() < 0.6;
      decor.people.push({
        horiz, line: horiz ? A.pick(streetsY) + ri(-4, 4) : A.pick(streetsX) + ri(-3, 3),
        p: horiz ? rf(10, W.wallX - 120) : rf(10, W.H - 10), v: rf(4, 10) * (r() < 0.5 ? -1 : 1),
        col: A.pick(['#c84a4a', '#3d6fa8', '#d9b74a', '#efe6d0', '#5a8a46', '#8a5a9a', '#6b4a2c']), ph: r() * 6,
      });
    }

    // мини-карта
    const mini = document.createElement('canvas');
    mini.width = 320; mini.height = 140;
    const mc = mini.getContext('2d');
    mc.imageSmoothingEnabled = true;
    mc.drawImage(cv, 0, 0, 320, 140);

    A.bg = cv; A.decor = decor; A.miniBg = mini;
  };
})(window.AOT);
