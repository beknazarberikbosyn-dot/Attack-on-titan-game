// Мир: остров Парадиз — три кольца стен, районы, Митрас, реки, леса, деревни.
// Своя пиксельная карта по географии сюжета (не копия официального арта).
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const W = A.WORLD;
  const C = (A.C = { x: 2000, y: 1900 });
  const R = (A.R = { maria: 1650, rose: 1000, sina: 520 });
  const T = (A.WALL_T = { maria: 22, rose: 30, sina: 22 });
  A.DEPLOY_OUT = 520; // как далеко за Стену Роза можно высадить бойцов
  const D2R = Math.PI / 180;

  function mkDistricts(R0, rd, list) {
    return list.map((d, i) => {
      const a = d.deg * D2R, nx = Math.round(Math.cos(a)), ny = Math.round(Math.sin(a));
      return Object.assign({}, d, {
        idx: i, ang: a, nx, ny, r: rd,
        cx: C.x + nx * R0, cy: C.y + ny * R0,           // центр выступа (на кольце)
        gx: C.x + nx * (R0 + rd), gy: C.y + ny * (R0 + rd), // внешние ворота
      });
    });
  }
  // Районы-выступы Стены Роза (на них и идут титаны — ради этого районы и строили)
  A.DISTRICTS = mkDistricts(R.rose, 150, [
    { id: 'trost', name: 'Трост', dir: 'юг', deg: 90 },
    { id: 'karanes', name: 'Каранес', dir: 'восток', deg: 0 },
    { id: 'yalkell', name: 'Ялкелл', dir: 'север', deg: -90 },
    { id: 'krolva', name: 'Кролва', dir: 'запад', deg: 180 },
  ]);
  A.SINA_D = mkDistricts(R.sina, 100, [
    { name: 'Эрмих', deg: 90 }, { name: 'Стохесс', deg: 0 }, { name: 'Орвуд', deg: -90 }, { name: 'Яркел', deg: 180 },
  ]);
  A.MARIA_D = mkDistricts(R.maria, 125, [
    { name: 'Шиганшина', deg: 90, breached: true }, { name: '', deg: 0 }, { name: '', deg: -90 }, { name: '', deg: 180 },
  ]);

  // ---------- Геометрия стен ----------
  function sdUnion(x, y, R0, dl) {
    let d = Math.hypot(x - C.x, y - C.y) - R0;
    for (const q of dl) { const e = Math.hypot(x - q.cx, y - q.cy) - q.r; if (e < d) d = e; }
    return d;
  }
  A.sdRose = (x, y) => sdUnion(x, y, R.rose, A.DISTRICTS); // >0 снаружи, <0 внутри
  A.roseNormal = function (x, y) {
    let d = Math.hypot(x - C.x, y - C.y) - R.rose, ox = C.x, oy = C.y;
    for (const q of A.DISTRICTS) { const e = Math.hypot(x - q.cx, y - q.cy) - q.r; if (e < d) { d = e; ox = q.cx; oy = q.cy; } }
    const dx = x - ox, dy = y - oy, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l, sd: d };
  };
  // точка на заданном расстоянии от стены (off>0 — снаружи, off<0 — внутри)
  A.wallPoint = function (x, y, off) {
    const n = A.roseNormal(x, y);
    const k = off - n.sd;
    return { x: x + n.x * k, y: y + n.y * k, nx: n.x, ny: n.y };
  };
  A.onRoseWall = (x, y) => Math.abs(A.sdRose(x, y)) <= T.rose / 2 + 3;
  A.insideRose = (x, y) => A.sdRose(x, y) < -T.rose / 2 - 2;
  A.nearestDistrict = function (x, y) {
    let b = A.DISTRICTS[0], bd = 1e9;
    for (const d of A.DISTRICTS) { const e = Math.hypot(x - d.gx, y - d.gy); if (e < bd) { bd = e; b = d; } }
    return b;
  };
  A.rFromC = (x, y) => Math.hypot(x - C.x, y - C.y);

  // ---------- Карта местности (сетка 4×4 px) ----------
  const GS = 4, GW = Math.ceil(W.W / GS), GH = Math.ceil(W.H / GS);
  const grid = new Uint8Array(GW * GH); // 0 луг, 1 лес гигантов, 2 лес, 3 руины, 4 вода, 5 море, 6 город, 7 горы, 8 поля
  A.terrainGrid = grid;
  const gcode = (x, y) => {
    const gx = (x / GS) | 0, gy = (y / GS) | 0;
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return 5;
    return grid[gy * GW + gx];
  };
  A.terrainCode = gcode;
  function mark(x, y, code, onlyLand) {
    const gx = (x / GS) | 0, gy = (y / GS) | 0;
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return;
    const k = gy * GW + gx;
    if (onlyLand && (grid[k] === 5 || grid[k] === 4)) return;
    grid[k] = code;
  }
  function markEll(cx, cy, rx, ry, code, onlyLand) {
    for (let y = cy - ry; y <= cy + ry; y += GS) for (let x = cx - rx; x <= cx + rx; x += GS) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) mark(x, y, code, onlyLand);
    }
  }

  A.TERRAIN_INFO = {
    town: { name: 'Город', anchor: 1, note: 'Крыши и шпили — опоры для тросов' },
    inner: { name: 'Земли за Стеной Роза', anchor: 0.8, note: 'Безопасный тыл' },
    wall: { name: 'Стена Роза', anchor: 1, note: 'Безопасно от обычных титанов' },
    nearwall: { name: 'Подножие стены', anchor: 0.95, note: 'Тросы цепляются за стену' },
    giantforest: { name: 'Лес гигантских деревьев', anchor: 1, note: 'Идеально для УПМ' },
    forest: { name: 'Лес', anchor: 0.85, note: 'Деревья — неплохие опоры' },
    village: { name: 'Руины деревни', anchor: 0.85, note: 'Невысокие дома — опор немного' },
    mountain: { name: 'Предгорья', anchor: 0.75, note: 'Скалы дают опору' },
    river: { name: 'Вода', anchor: 0.5, note: 'Здесь не встать' },
    sea: { name: 'Море', anchor: 0.5, note: 'За краем острова' },
    field: { name: 'Земли павшей Стены Мария', anchor: 0.55, note: 'Открытое поле — тросам не за что цепляться' },
  };
  A.terrainAt = function (x, y) {
    const code = gcode(x, y);
    if (code === 5) return 'sea';
    const sd = A.sdRose(x, y);
    if (Math.abs(sd) <= T.rose / 2 + 2) return 'wall';
    if (code === 4) return 'river';
    if (sd < 0) return code === 6 ? 'town' : 'inner';
    if (sd < T.rose / 2 + 110) return 'nearwall';
    return { 1: 'giantforest', 2: 'forest', 3: 'village', 6: 'village', 7: 'mountain' }[code] || 'field';
  };
  A.anchorAt = (x, y) => A.TERRAIN_INFO[A.terrainAt(x, y)].anchor;
  A.inRiver = (x, y) => { const c = gcode(x, y); return c === 4 || c === 5; };

  // склады снабжения — в каждом районе Розы и по диагоналям кольца
  A.SUPPLY = [];
  A.BOULDERS = [];
  for (const d of A.DISTRICTS) {
    A.SUPPLY.push({ x: d.gx - d.nx * (T.rose / 2 + 34) + d.ny * 40, y: d.gy - d.ny * (T.rose / 2 + 34) + d.nx * 40, district: d.idx });
    A.BOULDERS.push({ x: d.cx + d.nx * 55 - d.ny * 55, y: d.cy + d.ny * 55 - d.nx * 55, district: d.idx });
  }
  for (const deg of [45, 135, 225, 315]) {
    const a = deg * D2R;
    A.SUPPLY.push({ x: C.x + Math.cos(a) * (R.rose - 46), y: C.y + Math.sin(a) * (R.rose - 46) });
  }

  // ---------- Генерация карты ----------
  A.generateWorld = function () {
    const r = A.rng(20261016);
    const ri = (a, b) => Math.floor(a + r() * (b - a + 1));
    const rf = (a, b) => a + r() * (b - a);
    const rp = (arr) => arr[Math.floor(r() * arr.length)];
    const sh = A.shade;

    const cv = document.createElement('canvas');
    cv.width = W.W; cv.height = W.H;
    const c = cv.getContext('2d');
    const decor = {
      chimneys: [], flags: [], ripples: [], cannons: [], windmills: [], lamps: [], labels: [], streets: [], people: [],
    };

    // ===== 1. Базовый слой =====
    const img = c.createImageData(W.W, W.H);
    const d = img.data;
    const nA = A.makeNoise(7, 260), nB = A.makeNoise(8, 70), nL = A.makeNoise(13, 120), nM = A.makeNoise(17, 24);
    const S = 4, gw = GW + 1, gh = GH + 1;
    const gA = new Float32Array(gw * gh), gB = new Float32Array(gw * gh), gL = new Float32Array(gw * gh), gM = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const x = gx * S, y = gy * S, k = gy * gw + gx;
      gA[k] = nA(x, y); gB[k] = nB(x, y); gL[k] = nL(x, y); gM[k] = nM(x, y);
    }
    const landVal = (x, y, k) => Math.hypot(x - C.x, y - C.y) + (gA[k] - 0.5) * 360 + (gB[k] - 0.5) * 90;
    const COAST = 1835;
    for (let y = 0; y < W.H; y++) {
      for (let x = 0; x < W.W; x++) {
        const k = ((y / S) | 0) * gw + ((x / S) | 0);
        const h = A.hash(x, y, 3);
        const edge = Math.min(x, y, W.W - x, W.H - y) - 22 - gB[k] * 40;
        let lv = landVal(x, y, k);
        if (edge < 0) lv = Math.max(lv, COAST + 60);
        else if (edge < 60) lv = Math.max(lv, COAST + 30 - edge * 0.9);
        let R_, G_, B_, code = 0;
        const rr = Math.hypot(x - C.x, y - C.y);
        if (lv > COAST + 26) { // море
          const deep = lv > COAST + 120;
          R_ = deep ? 30 : 40; G_ = deep ? 68 : 86; B_ = deep ? 112 : 130;
          if (h > 0.994) { R_ = 120; G_ = 170; B_ = 200; }
          code = 5;
        } else if (lv > COAST) { // мелководье
          R_ = 62; G_ = 120; B_ = 150; if (h > 0.97) { R_ = 150; G_ = 196; B_ = 214; } code = 5;
        } else if (lv > COAST - 16) { // пляж
          R_ = 206 + h * 12; G_ = 188 + h * 10; B_ = 136 + h * 8;
        } else {
          const L = gL[k], M = gM[k];
          if (rr < R.sina) { // земли Сины — ухоженные сады
            R_ = 92 + M * 18; G_ = 144 + M * 20; B_ = 70 + M * 8;
          } else if (rr < R.rose) { // земли Розы — пашни и луга
            const dry = A.clamp((L - 0.42) * 2, 0, 1);
            R_ = 102 + dry * 40 + M * 14; G_ = 150 + dry * 14 + M * 14; B_ = 70 + dry * 8;
          } else if (rr < R.maria) { // павшие земли Марии — дикие, заросшие
            const dry = A.clamp((L - 0.5) * 2.4, 0, 1);
            R_ = 74 + dry * 58 + M * 16; G_ = 118 + dry * 24 + M * 16; B_ = 54 + dry * 12 + M * 6;
          } else { // за Стеной Мария — каменистые пустоши к морю
            const dry = A.clamp((L - 0.35) * 2, 0, 1);
            R_ = 98 + dry * 46 + M * 14; G_ = 122 + dry * 20 + M * 12; B_ = 72 + dry * 16;
            if (h > 0.985) { R_ = 140; G_ = 136; B_ = 126; }
          }
          if (h < 0.07) { R_ -= 20; G_ -= 24; B_ -= 14; } else if (h > 0.93) { R_ += 16; G_ += 20; B_ += 10; }
          if (h > 0.9985) { const f = A.hash(x, y, 9); if (f < 0.33) { R_ = 230; G_ = 220; B_ = 90; } else if (f < 0.66) { R_ = 236; G_ = 236; B_ = 236; } else { R_ = 200; G_ = 90; B_ = 150; } }
        }
        const i = (y * W.W + x) * 4;
        d[i] = R_; d[i + 1] = G_; d[i + 2] = B_; d[i + 3] = 255;
        if ((x & 3) === 0 && (y & 3) === 0) grid[(y >> 2) * GW + (x >> 2)] = code;
      }
    }
    c.putImageData(img, 0, 0);

    // ===== Помощники рисования =====
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
    function discOn(cx_, X, Y, rad, col, light, speck) {
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad + rad * 0.6) continue;
        let k = 1;
        if (light) k = 0.82 + ((-dx - dy) / (rad * 2)) * 0.45;
        if (speck && A.hash(X + dx, Y + dy, 21) > 0.86) k *= 0.8;
        if (speck && A.hash(X + dx, Y + dy, 22) > 0.95) k *= 1.2;
        cx_.fillStyle = sh(col, k); cx_.fillRect(X + dx, Y + dy, 1, 1);
      }
    }
    function ellOn(cx_, X, Y, rx, ry, col) {
      cx_.fillStyle = col;
      for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.01)))); cx_.fillRect(X - w, Y + dy, w * 2, 1); }
    }
    function sprite(w, h, fn) { const s = document.createElement('canvas'); s.width = w; s.height = h; fn(s.getContext('2d'), w, h); return s; }

    // кэш спрайтов: деревья, гиганты, кусты, камни, горы
    const TREE_COLS = ['#4f8a3a', '#5d9a40', '#467d34', '#6a8f3a', '#3f7a34', '#2f5a2a', '#36662e'];
    const treeSpr = [];
    for (let i = 0; i < 18; i++) {
      const rad = 3 + (i % 6), col = TREE_COLS[i % TREE_COLS.length];
      treeSpr.push(sprite(rad * 3 + 6, rad * 2 + 10, (s, w, h) => {
        ellOn(s, rad + 2 + Math.round(rad * 0.6), h - 4, rad, Math.max(2, Math.round(rad * 0.45)), 'rgba(20,24,16,0.28)');
        s.fillStyle = '#5a3d24'; s.fillRect(rad + 1, h - 7, 2, 4);
        discOn(s, rad + 2, rad + 1, rad, col, true, true);
      }));
    }
    const giantSpr = [];
    for (let i = 0; i < 8; i++) {
      giantSpr.push(sprite(110, 130, (s, w, h) => {
        const cx = 50, cy = 124, tw = 10 + (i % 4) * 2, th = 44 + (i * 7) % 30;
        ellOn(s, cx + 28, cy, 44, 12, 'rgba(15,20,12,0.32)');
        s.fillStyle = '#4a3420'; s.fillRect(cx - tw / 2 - 3, cy - 3, tw + 6, 4);
        for (let k = 0; k < tw; k++) { s.fillStyle = sh('#6b4a2c', k < tw * 0.3 ? 0.78 : 0.75 + (k / tw) * 0.45); s.fillRect(cx - tw / 2 + k, cy - th, 1, th); }
        for (let yy = cy - th; yy < cy; yy += 3) if (A.hash(i, yy, 5) > 0.5) { s.fillStyle = '#3f2b19'; s.fillRect(cx - tw / 2 + 1 + Math.floor(A.hash(i, yy, 6) * (tw - 2)), yy, 1, 3); }
        for (let k = 0; k < 5; k++) {
          const ox = Math.round((A.hash(i, k, 7) - 0.5) * 50), oy = Math.round(A.hash(i, k, 8) * 24) - 4, rr = 16 + Math.round(A.hash(i, k, 9) * 10);
          discOn(s, cx + ox, Math.max(rr, cy - th - oy), rr, ['#2f5a2a', '#36662e', '#2a5226', '#3d6f33'][k % 4], true, true);
        }
      }));
    }
    const bushSpr = [];
    for (let i = 0; i < 6; i++) bushSpr.push(sprite(12, 10, (s) => { ellOn(s, 7, 8, 4, 2, 'rgba(20,24,16,0.25)'); discOn(s, 5, 5, 3, ['#4a7d35', '#5d8f3e', '#3f6e30'][i % 3], true, true); if (i % 3 === 0) { s.fillStyle = '#c84a4a'; s.fillRect(4, 3, 1, 1); } }));
    const rockSpr = [];
    for (let i = 0; i < 6; i++) { const rs = 2 + i % 4; rockSpr.push(sprite(rs * 3 + 4, rs * 2 + 4, (s) => { ellOn(s, rs + 2 + Math.round(rs * 0.5), rs * 2 + 1, rs, Math.max(1, Math.round(rs * 0.4)), 'rgba(20,24,16,0.3)'); discOn(s, rs + 1, rs + 1, rs, '#8d8b85', true, true); })); }
    const mtnSpr = [];
    for (let i = 0; i < 6; i++) {
      const mw = 70 + i * 12, mh = 48 + i * 7;
      mtnSpr.push(sprite(mw, mh + 6, (s) => {
        ellOn(s, mw / 2 + 8, mh + 1, mw / 2 - 4, 5, 'rgba(20,20,16,0.3)');
        for (let y = 0; y < mh; y++) {
          const half = (y / mh) * (mw / 2);
          for (let x = -half; x < half; x++) {
            const X = Math.round(mw / 2 + x);
            let col = x < 0 ? '#8d8676' : '#6c665a';
            if (y < mh * 0.26 + Math.sin(x * 0.7 + i) * 2) col = x < 0 ? '#f2f2ee' : '#cfd3d6';
            if (A.hash(X, y, i + 40) > 0.93) col = sh(col, 0.85);
            s.fillStyle = col; s.fillRect(X, y, 1, 1);
          }
        }
      }));
    }
    const put = (spr, x, y) => c.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height + 2));
    const isLand = (x, y) => { const k = gcode(x, y); return k !== 5 && k !== 4; };
    const nearAnyWall = (x, y, m) => {
      const rr = A.rFromC(x, y);
      if (Math.abs(A.sdRose(x, y)) < T.rose / 2 + m) return true;
      if (Math.abs(sdUnion(x, y, R.sina, A.SINA_D)) < T.sina / 2 + m) return true;
      if (Math.abs(sdUnion(x, y, R.maria, A.MARIA_D)) < T.maria / 2 + m) return true;
      return rr < 0;
    };
    const inAnyDistrictDisc = (x, y, m) => [...A.DISTRICTS, ...A.SINA_D, ...A.MARIA_D].some((q) => Math.hypot(x - q.cx, y - q.cy) < q.r + (m || 0)) || A.rFromC(x, y) < 190 + (m || 0);

    function stampLine(pts, rad, colFn) {
      for (let p = 0; p < pts.length - 1; p++) {
        const [x1, y1] = pts[p], [x2, y2] = pts[p + 1];
        const L = Math.hypot(x2 - x1, y2 - y1);
        for (let s = 0; s <= L; s += 1.5) {
          const x = x1 + (x2 - x1) * (s / L), y = y1 + (y2 - y1) * (s / L);
          colFn(x, y, rad);
        }
      }
    }
    function wobblyPath(points, amp, seed) {
      const out = [];
      const nW = A.makeNoise(seed, 90);
      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i], [x2, y2] = points[i + 1];
        const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(L / 30));
        const nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
        for (let k = 0; k < n; k++) {
          const t = k / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
          const o = (nW(x, y) - 0.5) * 2 * amp;
          out.push([x + nx * o, y + ny * o]);
        }
      }
      out.push(points[points.length - 1]);
      return out;
    }
    const polar = (deg, rr) => [C.x + Math.cos(deg * D2R) * rr, C.y + Math.sin(deg * D2R) * rr];

    // ===== 2. Горы, озёра, реки =====
    const MOUNTAINS = [{ deg: -132, r: 1400, n: 26, spread: 210 }, { deg: -150, r: 1740, n: 14, spread: 160 }, { deg: 205, r: 1720, n: 8, spread: 120 }];
    const mtns = [];
    for (const m of MOUNTAINS) {
      const [mx, my] = polar(m.deg, m.r);
      for (let k = 0; k < m.n; k++) {
        const x = mx + rf(-m.spread, m.spread), y = my + rf(-m.spread * 0.6, m.spread * 0.6);
        if (!isLand(x, y) || nearAnyWall(x, y, 40)) continue;
        mtns.push({ x, y, i: ri(0, 5) });
        markEll(Math.round(x), Math.round(y), 40, 18, 7, true);
      }
    }
    const LAKES = [{ deg: -45, r: 760, rx: 72, ry: 44 }, { deg: 196, r: 1340, rx: 90, ry: 56 }, { deg: -100, r: 330, rx: 46, ry: 30 }];
    for (const L of LAKES) {
      const [lx, ly] = polar(L.deg, L.r);
      L.x = lx; L.y = ly;
      ellOn(c, Math.round(lx), Math.round(ly), L.rx + 5, L.ry + 4, '#c8b888');
      ellOn(c, Math.round(lx), Math.round(ly), L.rx, L.ry, '#3d6e94');
      ellOn(c, Math.round(lx - 6), Math.round(ly - 4), Math.round(L.rx * 0.7), Math.round(L.ry * 0.6), '#4a7ea6');
      markEll(Math.round(lx), Math.round(ly), L.rx, L.ry, 4);
      for (let k = 0; k < 40; k++) decor.ripples.push({ x: lx + rf(-L.rx * 0.8, L.rx * 0.8), y: ly + rf(-L.ry * 0.7, L.ry * 0.7), ph: r() * 6.28 });
    }
    const RIVERS = [
      wobblyPath([[LAKES[0].x, LAKES[0].y], polar(-30, 1100), polar(-18, 1500), polar(-12, 1950)], 60, 31),
      wobblyPath([[LAKES[1].x, LAKES[1].y], polar(205, 1560), polar(214, 1980)], 40, 32),
      wobblyPath([[LAKES[2].x, LAKES[2].y], polar(-80, 700), polar(-62, 1250), [LAKES[0].x, LAKES[0].y]], 50, 33),
      wobblyPath([polar(150, 230), polar(130, 700), polar(120, 1200), polar(112, 1600), polar(108, 1980)], 70, 34),
    ];
    for (const rv of RIVERS) {
      stampLine(rv, 9, (x, y, rad) => { px(x - rad - 2, y - rad - 2, rad * 2 + 4, rad * 2 + 4, '#b8a878'); });
      stampLine(rv, 7, (x, y, rad) => { px(x - rad, y - rad, rad * 2, rad * 2, '#3f73a0'); mark(x, y, 4); mark(x + 4, y, 4); mark(x - 4, y, 4); mark(x, y + 4, 4); mark(x, y - 4, 4); });
      stampLine(rv, 3, (x, y) => { if (A.hash(x | 0, y | 0, 12) > 0.6) px(x, y, 1, 1, '#5a8cb8'); });
      for (let i = 0; i < rv.length - 1; i += 1) { const [x, y] = rv[i]; for (let k = 0; k < 3; k++) decor.ripples.push({ x: x + rf(-5, 5), y: y + rf(-5, 5), ph: r() * 6.28 }); }
    }

    // ===== 3. Поля =====
    const FIELD_KINDS = [
      { base: '#d8b75a', row: '#b8953e' }, { base: '#7aa344', row: '#5f8a34' }, { base: '#7a5a3a', row: '#5f442a' },
      { base: '#a7b84e', row: '#889a3a' }, { base: '#c9a95a', row: '#e0c878' },
    ];
    const fields = [];
    function field(x, y, w, h, wild) {
      if (fields.some((f) => x < f.x + f.w + 6 && x + w + 6 > f.x && y < f.y + f.h + 6 && y + h + 6 > f.y)) return false;
      for (const [xx, yy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2]]) {
        if (!isLand(xx, yy) || gcode(xx, yy) === 7 || nearAnyWall(xx, yy, 30) || inAnyDistrictDisc(xx, yy, 20)) return false;
      }
      fields.push({ x, y, w, h });
      const fk = rp(FIELD_KINDS);
      const base = wild ? sh(fk.base, 0.82) : fk.base;
      px(x, y, w, h, base);
      for (let yy = y + 1; yy < y + h; yy += 3) px(x, yy, w, 1, wild ? sh(fk.row, 0.85) : fk.row);
      if (wild) for (let i = 0; i < w * h / 25; i++) px(x + ri(0, w - 1), y + ri(0, h - 1), ri(1, 3), ri(1, 2), rp(['#5d8f3e', '#4a7d35', '#7a9a44']));
      if (!wild) {
        for (let xx = x; xx <= x + w; xx += 1) { px(xx, y, 1, 1, '#7a5a38'); px(xx, y + h, 1, 1, '#7a5a38'); if (xx % 6 === 0) { px(xx, y - 2, 1, 3, '#5f4428'); px(xx, y + h - 2, 1, 3, '#5f4428'); } }
        for (let yy = y; yy < y + h; yy++) { px(x, yy, 1, 1, '#7a5a38'); px(x + w, yy, 1, 1, '#7a5a38'); }
      }
      for (let gx = x; gx < x + w; gx += GS) for (let gy = y; gy < y + h; gy += GS) mark(gx, gy, 8, true);
      return true;
    }
    for (let k = 0, n = 0; k < 2600 && n < 260; k++) {
      const a = rf(0, 360), rr = Math.sqrt(rf(0.02, 1)) * R.rose;
      const [x, y] = polar(a, rr);
      if (field(Math.round(x), Math.round(y), ri(40, 110), ri(30, 80), false)) n++;
    }
    for (let k = 0, n = 0; k < 1500 && n < 80; k++) {
      const a = rf(0, 360), rr = rf(R.rose + 60, R.maria - 60);
      const [x, y] = polar(a, rr);
      if (field(Math.round(x), Math.round(y), ri(40, 100), ri(30, 70), true)) n++;
    }

    // ===== 4. Дороги =====
    function road(points, wid, ruined) {
      const pts = wobblyPath(points, 14, 50 + points.length);
      stampLine(pts, wid + 1, (x, y, rad) => { if (gcode(x, y) !== 4) px(x - rad, y - rad, rad * 2, rad * 2, ruined ? '#8a7a56' : '#8a7350'); });
      stampLine(pts, wid, (x, y, rad) => {
        if (gcode(x, y) === 4) px(x - rad - 1, y - rad - 1, rad * 2 + 2, rad * 2 + 2, '#7d5631'); // мост
        else {
          px(x - rad, y - rad, rad * 2, rad * 2, ruined ? '#9a8a64' : '#a58a5e');
          if (ruined && A.hash(x | 0, y | 0, 7) > 0.8) px(x, y, 2, 1, '#6a8a3e');
        }
      });
    }
    for (const deg of [90, 0, -90, 180]) { road([polar(deg, 150), polar(deg, R.sina)], 4); road([polar(deg, R.sina + 100), polar(deg, R.rose)], 4); road([polar(deg, R.rose + 150), polar(deg, R.maria)], 4, true); }
    for (const deg of [45, 135, 225, 315]) road([polar(deg, R.sina + 10), polar(deg + 8, R.rose - 40)], 3);
    const ring = (rr, wid, ruined, step) => { const pts = []; for (let a = 0; a <= 360; a += step || 4) pts.push(polar(a, rr)); road(pts, wid, ruined); };
    ring(R.sina + 70, 3); ring(R.rose - 60, 3); ring(R.rose + 270, 3, true, 5);

    // ===== 5. Леса =====
    const FORESTS = A.FORESTS = [
      { deg: 42, r: 1330, rx: 240, ry: 170, giant: true, name: 'Лес гигантских деревьев' },
      { deg: -38, r: 1340, rx: 170, ry: 120 }, { deg: 160, r: 1290, rx: 190, ry: 130 }, { deg: -112, r: 1330, rx: 150, ry: 100 },
      { deg: 120, r: 1400, rx: 120, ry: 90 }, { deg: -150, r: 760, rx: 120, ry: 90, name: 'Леса Даупера' },
      { deg: 140, r: 760, rx: 90, ry: 70 }, { deg: 30, r: 700, rx: 80, ry: 60 }, { deg: 250, r: 360, rx: 60, ry: 45 },
      { deg: 70, r: 1760, rx: 120, ry: 60 }, { deg: -10, r: 1730, rx: 100, ry: 80 },
    ];
    const fN = A.makeNoise(91, 40);
    const allTrees = [];
    for (const f of FORESTS) {
      [f.x, f.y] = polar(f.deg, f.r);
      const inF = (x, y) => ((x - f.x) / f.rx) ** 2 + ((y - f.y) / f.ry) ** 2 + (fN(x, y) - 0.5) * 0.6 < 1;
      f.inside = inF;
      for (let y = f.y - f.ry; y <= f.y + f.ry; y += GS) for (let x = f.x - f.rx; x <= f.x + f.rx; x += GS) if (inF(x, y) && isLand(x, y) && !nearAnyWall(x, y, 10)) mark(x, y, f.giant ? 1 : 2, true);
      // тёмная подстилка
      for (let y = f.y - f.ry; y <= f.y + f.ry; y += 2) for (let x = f.x - f.rx; x <= f.x + f.rx; x += 2) if (inF(x, y) && isLand(x, y) && !nearAnyWall(x, y, 6)) px(x, y, 2, 2, A.hash(x, y, 4) > 0.9 ? '#5a4a2a' : f.giant ? '#2f4a26' : '#3b5e30');
      const n = f.giant ? Math.round(f.rx * f.ry / 900) : Math.round(f.rx * f.ry / 260);
      for (let k = 0; k < n; k++) {
        const x = f.x + rf(-f.rx, f.rx), y = f.y + rf(-f.ry, f.ry);
        if (!inF(x, y) || !isLand(x, y) || nearAnyWall(x, y, 16)) continue;
        allTrees.push({ x, y, g: f.giant });
      }
    }
    // одиночные деревья, кусты, камни
    for (let k = 0; k < 4200; k++) {
      const x = rf(20, W.W - 20), y = rf(20, W.H - 20);
      const code = gcode(x, y);
      if (code !== 0 || nearAnyWall(x, y, 12) || inAnyDistrictDisc(x, y, 6)) continue;
      allTrees.push({ x, y, s: r() < 0.45 ? 'tree' : r() < 0.75 ? 'bush' : 'rock' });
    }

    // ===== 6. Дома, деревни, города =====
    function house(x, y, w, h, opts) {
      opts = opts || {};
      const roofs = opts.rich ? ['#4f5a68', '#3d5a7a', '#6c6f7d', '#8b3f2f'] : ['#9e4a35', '#8b3f2f', '#6c6f7d', '#5b6170', '#a8683c', '#7a4b3a', '#4f5a68'];
      const walls = ['#e2d6bc', '#d8c8a6', '#cfc2a8', '#e8dfca', '#c9b48e'];
      const roof = opts.roof || rp(roofs), wallC = opts.wall || rp(walls);
      const wallH = Math.max(4, Math.round(h * 0.38)), roofH = h - wallH;
      c.fillStyle = 'rgba(25,22,18,0.33)'; c.fillRect(x + 2, y + 2, w, h);
      px(x, y, w, roofH, roof);
      px(x, y, w, Math.floor(roofH / 2), sh(roof, 0.8));
      for (let yy = y + 2; yy < y + roofH - 1; yy += 3) px(x, yy, w, 1, sh(roof, yy < y + roofH / 2 ? 0.7 : 0.88));
      px(x, y + Math.floor(roofH / 2), w, 1, sh(roof, 1.18));
      px(x, y + roofH - 1, w, 1, sh(roof, 0.55));
      if (opts.ruined) { const hx = x + ri(1, Math.max(1, w - 6)), hy = y + ri(0, Math.max(1, roofH - 4)); px(hx, hy, ri(3, 6), ri(2, 4), '#2a2420'); }
      px(x, y + roofH, w, wallH, wallC);
      px(x, y + roofH, 1, wallH, sh(wallC, 0.7)); px(x + w - 1, y + roofH, 1, wallH, sh(wallC, 0.75));
      const door = x + ri(1, Math.max(1, w - 4));
      for (let xx = x + 2; xx < x + w - 2; xx += 5) {
        if (Math.abs(xx - door) < 3) continue;
        px(xx, y + roofH + 1, 2, Math.min(3, wallH - 2), opts.ruined ? '#1e1a16' : r() < 0.25 ? '#f2d27a' : '#33414f');
        if (!opts.ruined && r() < 0.2) px(xx - 1, y + roofH + 4, 3, 1, rp(['#c84a4a', '#d9c050', '#c86fb0']));
      }
      px(door, y + h - 4, 2, 4, opts.ruined ? '#1e1a16' : '#5a3a20');
      if (!opts.ruined && r() < 0.6 && roofH > 5) {
        const cx = x + ri(1, w - 4), cy = y + ri(0, Math.max(0, roofH - 5));
        px(cx, cy, 2, 4, '#77706a'); decor.chimneys.push({ x: cx + 1, y: cy, ph: r() * 10 });
      }
      if (opts.ruined) for (let i = 0; i < 4; i++) px(x + ri(-3, w + 2), y + h + ri(0, 3), ri(1, 3), 1, rp(['#8a7f70', '#6d6458', '#a39784']));
    }
    function cobble(x, y, w, h, base) {
      px(x, y, w, h, base);
      for (let yy = y; yy < y + h; yy += 2) for (let xx = x + ((yy >> 1) % 2); xx < x + w; xx += 3) if (A.hash(xx, yy, 77) > 0.55) px(xx, yy, 2, 1, sh(base, 0.86));
    }
    function crate(x, y) { px(x, y - 4, 4, 4, '#a07a48'); px(x, y - 4, 4, 1, '#c09460'); }
    function barrel(x, y) { px(x, y - 4, 3, 4, '#7a5532'); px(x, y - 3, 3, 1, '#4a3420'); }

    function cityCells(cx, cy, rad, inside, opts) {
      opts = opts || {};
      const cell = opts.cell || 20;
      // мостовая
      for (let y = cy - rad; y <= cy + rad; y += 2) for (let x = cx - rad; x <= cx + rad; x += 2) {
        if (!inside(x, y)) continue;
        c.fillStyle = A.hash(x, y, 77) > 0.6 ? sh(opts.ground || '#9a917f', 0.88) : (opts.ground || '#9a917f');
        c.fillRect(x, y, 2, 2);
        mark(x, y, 6);
      }
      for (let gy = cy - rad; gy < cy + rad; gy += cell) {
        for (let gx = cx - rad; gx < cx + rad; gx += cell) {
          const hx = gx + 2, hy = gy + 3, hw = cell - 5 - ri(0, 3), hh = cell - 6 - ri(0, 3);
          if (!inside(hx, hy) || !inside(hx + hw, hy + hh) || !inside(hx + hw, hy) || !inside(hx, hy + hh)) continue;
          if (opts.skip && opts.skip(hx + hw / 2, hy + hh / 2)) continue;
          if (r() < (opts.gap || 0.06)) { if (r() < 0.5) discOn(c, hx + hw / 2 | 0, hy + hh / 2 | 0, 3, '#4f8a3a', true, true); continue; }
          house(hx, hy, hw, hh, { ruined: opts.ruined, rich: opts.rich });
        }
      }
      // улицы для жителей
      if (!opts.ruined) for (let gy = cy - rad; gy < cy + rad; gy += cell) {
        if (inside(cx, gy) && r() < 0.5) decor.streets.push({ x1: cx - rad * 0.7, y1: gy, x2: cx + rad * 0.7, y2: gy, inside });
      }
    }

    // Митрас — столица
    const mitrasIn = (x, y) => A.rFromC(x, y) < 185;
    cityCells(C.x, C.y, 185, mitrasIn, { rich: true, ground: '#a9a08c', skip: (x, y) => Math.abs(x - C.x) < 50 && Math.abs(y - C.y) < 40 || Math.abs(x - C.x) < 5 || Math.abs(y - C.y) < 5 });
    // дворец
    {
      const x = C.x - 40, y = C.y - 30;
      c.fillStyle = 'rgba(25,22,18,0.35)'; c.fillRect(x + 4, y + 4, 80, 58);
      px(x, y, 80, 40, '#3d5a7a'); px(x, y, 80, 20, '#2f4a68'); px(x, y + 20, 80, 1, '#5a7aa0');
      px(x, y + 40, 80, 18, '#e8dfca');
      for (let xx = x + 4; xx < x + 76; xx += 6) px(xx, y + 44, 3, 8, '#33414f');
      px(x + 36, y + 48, 8, 10, '#5a3a20');
      for (const tx of [x - 6, x + 74]) { px(tx, y - 14, 12, 72, '#e2d6bc'); px(tx - 1, y - 20, 14, 8, '#2f4a68'); px(tx + 5, y - 28, 2, 8, '#2a2a2a'); decor.flags.push({ x: tx + 6, y: y - 28, col: '#c9a24a' }); }
      px(C.x - 2, y - 30, 4, 20, '#e2d6bc'); px(C.x - 4, y - 36, 8, 6, '#c9a24a');
    }
    decor.labels.push({ x: C.x, y: C.y - 205, text: 'МИТРАС', size: 3 });

    // районы: выступы стен
    function districtCity(D, R0, Tt, opts) {
      const inside = (x, y) => Math.hypot(x - D.cx, y - D.cy) < D.r - Tt / 2 - 4 && A.rFromC(x, y) > R0 + Tt / 2 + 4;
      const axis = (x, y) => Math.abs(D.nx ? y - D.cy : x - D.cx) < 6;
      cityCells(Math.round(D.cx + D.nx * D.r / 2), Math.round(D.cy + D.ny * D.r / 2), D.r, inside, Object.assign({ skip: axis }, opts));
      // главная улица от ворот до ворот
      decor.streets.push({ x1: D.cx, y1: D.cy, x2: D.gx, y2: D.gy, inside });
    }
    A.DISTRICTS.forEach((D) => districtCity(D, R.rose, T.rose, { cell: 19 }));
    A.SINA_D.forEach((D) => districtCity(D, R.sina, T.sina, { cell: 18, rich: true }));
    A.MARIA_D.forEach((D) => districtCity(D, R.maria, T.maria, { cell: 19, ruined: true, gap: 0.2 }));
    // города и у внутренней стороны районов Розы (дома за кольцом)
    for (const D of A.DISTRICTS) {
      const bx = D.cx - D.nx * 70, by = D.cy - D.ny * 70;
      const inside = (x, y) => Math.hypot(x - bx, y - by) < 70 && A.rFromC(x, y) < R.rose - T.rose / 2 - 6 && !(Math.abs(D.nx ? y - D.cy : x - D.cx) < 6);
      cityCells(Math.round(bx), Math.round(by), 70, inside, { cell: 19 });
    }
    // деревни
    const VILLAGES = [];
    function village(x, y, n, ruined, name) {
      if (!isLand(x, y) || nearAnyWall(x, y, 40) || inAnyDistrictDisc(x, y, 30)) return false;
      VILLAGES.push({ x, y, ruined });
      for (let k = 0; k < n; k++) {
        const hx = x + ri(-45, 45), hy = y + ri(-35, 35);
        if (!isLand(hx, hy) || !isLand(hx + 20, hy + 18)) continue;
        house(hx, hy, ri(13, 22), ri(12, 18), { ruined });
        for (let gx = hx; gx < hx + 20; gx += GS) for (let gy = hy; gy < hy + 18; gy += GS) mark(gx, gy, ruined ? 3 : 6, true);
      }
      if (!ruined && r() < 0.6) { const wx = x + ri(-60, 60), wy = y + ri(-50, 50); if (isLand(wx, wy)) decor.windmills.push({ x: wx, y: wy - 22, base: [wx, wy] }); }
      if (name) decor.labels.push({ x, y: y - 50, text: name, size: 1 });
      return true;
    }
    village(...polar(105, 820), 12, false, 'Рагако');
    village(...polar(-152, 840), 9, false, 'Даупер');
    for (let k = 0, n = 0; k < 400 && n < 16; k++) { const [x, y] = polar(rf(0, 360), rf(R.sina + 120, R.rose - 120)); if (village(x, y, ri(6, 11), false)) n++; }
    for (let k = 0, n = 0; k < 400 && n < 12; k++) { const [x, y] = polar(rf(0, 360), rf(R.rose + 200, R.maria - 120)); if (village(x, y, ri(6, 12), true)) n++; }
    for (let k = 0, n = 0; k < 200 && n < 6; k++) { const [x, y] = polar(rf(0, 360), rf(R.maria + 60, 1760)); if (village(x, y, ri(4, 7), true)) n++; }
    for (let k = 0, n = 0; k < 200 && n < 6; k++) { const [x, y] = polar(rf(0, 360), rf(230, R.sina - 80)); if (village(x, y, ri(5, 9), false)) n++; }
    // замок Утгард
    {
      const [ux, uy] = polar(128, 690);
      c.fillStyle = 'rgba(25,22,18,0.35)'; c.fillRect(ux - 14, uy - 10, 34, 30);
      px(ux - 18, uy - 14, 36, 28, '#8f887a');
      for (let yy = uy - 14; yy < uy + 14; yy += 4) px(ux - 18, yy, 36, 1, '#77706a');
      px(ux - 6, uy - 28, 14, 20, '#a39c8e'); px(ux - 7, uy - 32, 16, 5, '#5b6170');
      for (const [tx, ty] of [[ux - 22, uy - 18], [ux + 14, uy - 18], [ux - 22, uy + 8], [ux + 14, uy + 8]]) { px(tx, ty, 8, 10, '#a39c8e'); px(tx - 1, ty - 3, 10, 3, '#5b6170'); }
      px(ux - 2, uy + 6, 5, 8, '#2a2420');
      mark(ux, uy, 6);
      decor.labels.push({ x: ux, y: uy - 44, text: 'Замок Утгард', size: 1 });
    }

    // ===== 7. Деревья и горы (сортировка по y) =====
    const things = allTrees.concat(mtns.map((m) => ({ x: m.x, y: m.y, m: m.i })));
    things.sort((a, b) => a.y - b.y);
    for (const t of things) {
      if (t.m != null) put(mtnSpr[t.m], t.x, t.y);
      else if (t.g) put(giantSpr[ri(0, giantSpr.length - 1)], t.x, t.y);
      else if (t.s === 'bush') put(bushSpr[ri(0, 5)], t.x, t.y);
      else if (t.s === 'rock') put(rockSpr[ri(0, 5)], t.x, t.y);
      else put(treeSpr[ri(0, treeSpr.length - 1)], t.x, t.y);
    }

    // ===== 8. Стены (по пикселям) =====
    const id2 = c.getImageData(0, 0, W.W, W.H), d2 = id2.data;
    const setPx = (x, y, R_, G_, B_, a) => {
      const i = (y * W.W + x) * 4;
      if (a == null || a >= 1) { d2[i] = R_; d2[i + 1] = G_; d2[i + 2] = B_; }
      else { d2[i] = d2[i] * (1 - a) + R_ * a; d2[i + 1] = d2[i + 1] * (1 - a) + G_ * a; d2[i + 2] = d2[i + 2] * (1 - a) + B_ * a; }
    };
    function wallPass(R0, dl, Tt, base, breaches) {
      const [bR, bG, bB] = A.hex(base);
      const half = Tt / 2, shadowW = Tt * 0.7;
      const visit = (x, y) => {
        if (x < 0 || y < 0 || x >= W.W || y >= W.H) return;
        const rr = Math.hypot(x - C.x, y - C.y);
        let sd = rr - R0, ox = C.x, oy = C.y, rad = R0, dist = rr;
        for (const q of dl) { const e = Math.hypot(x - q.cx, y - q.cy) - q.r; if (e < sd) { sd = e; ox = q.cx; oy = q.cy; rad = q.r; dist = e + q.r; } }
        let inner = false; // внутренняя стена района (кольцо внутри выступа)
        if (Math.abs(rr - R0) <= half) for (const q of dl) if (Math.hypot(x - q.cx, y - q.cy) < q.r - half) inner = true;
        let across, along;
        if (Math.abs(sd) <= half) { across = sd + half; along = Math.atan2(y - oy, x - ox) * rad; }
        else if (inner) { across = rr - R0 + half; along = Math.atan2(y - C.y, x - C.x) * R0; }
        else {
          if (sd > half && sd < half + shadowW) setPx(x, y, 15, 18, 12, 0.38 * (1 - (sd - half) / shadowW));
          return;
        }
        for (const b of breaches) if (Math.hypot(x - b[0], y - b[1]) < 20) { return; }
        const row = Math.floor(across / 4);
        const off = row % 2 ? 4 : 0;
        const mortar = Math.floor(across) % 4 === 0 || Math.floor(Math.abs(along) + off) % 9 === 0;
        const tint = A.hash(Math.floor((Math.abs(along) + off) / 9), row, 41);
        let k = mortar ? 0.72 : 0.9 + tint * 0.16;
        if (across > Tt - 4) k *= Math.floor(Math.abs(along) / 4) % 2 ? 1.12 : 0.78; // зубцы
        else if (across < 3) k *= 0.8;
        if (Math.abs(across - 6) < 1) k *= 0.85; // дорожка
        setPx(x, y, bR * k, bG * k, bB * k);
      };
      const out = R0 + half + shadowW + 2;
      for (let y = Math.max(0, Math.floor(C.y - out)); y <= Math.min(W.H - 1, Math.ceil(C.y + out)); y++) {
        const dy = y - C.y;
        const xo = Math.sqrt(Math.max(0, out * out - dy * dy)), inn = R0 - half - 1;
        const xi = Math.abs(dy) < inn ? Math.sqrt(inn * inn - dy * dy) : 0;
        for (let x = Math.floor(C.x - xo); x <= Math.floor(C.x - xi); x++) visit(x, y);
        for (let x = Math.ceil(C.x + xi); x <= Math.ceil(C.x + xo); x++) visit(x, y);
      }
      for (const q of dl) {
        const e = q.r + half + shadowW + 2;
        for (let y = Math.floor(q.cy - e); y <= q.cy + e; y++) for (let x = Math.floor(q.cx - e); x <= q.cx + e; x++) {
          const rr = Math.hypot(x - C.x, y - C.y);
          if (Math.abs(rr - R0) <= out - R0 && rr >= R0 - half - 1) continue; // уже пройдено кольцом
          visit(x, y);
        }
      }
    }
    const shig = A.MARIA_D[0];
    wallPass(R.maria, A.MARIA_D, T.maria, '#9d9482', [[shig.gx, shig.gy], [shig.cx, shig.cy]]);
    wallPass(R.rose, A.DISTRICTS, T.rose, '#aa9f8a', []);
    wallPass(R.sina, A.SINA_D, T.sina, '#b4ab98', []);
    c.putImageData(id2, 0, 0);

    // ===== 9. Ворота, башни, пушки =====
    function gate(x, y, nx, ny, size, broken) {
      const s = size;
      if (broken) {
        for (let i = 0; i < 26; i++) px(x + rf(-s, s), y + rf(-s, s), ri(2, 5), ri(2, 4), rp(['#8a7f70', '#6d6458', '#a39784', '#5a5248']));
        return;
      }
      const w = nx ? s : s * 2, h = nx ? s * 2 : s;
      px(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4, '#8f856f');
      px(x - w / 2, y - h / 2, w, h, '#9a8f7a');
      // проём и решётка с внешней стороны
      const ox = x + nx * (s / 2 - 3), oy = y + ny * (s / 2 - 3);
      const gw2 = nx ? 4 : s * 1.1, gh2 = nx ? s * 1.1 : 4;
      px(ox - gw2 / 2, oy - gh2 / 2, gw2, gh2, '#1f1c1a');
      c.fillStyle = '#5a5650';
      if (nx) for (let yy = oy - gh2 / 2; yy < oy + gh2 / 2; yy += 3) c.fillRect(Math.round(ox - gw2 / 2), Math.round(yy), gw2, 1);
      else for (let xx = ox - gw2 / 2; xx < ox + gw2 / 2; xx += 3) c.fillRect(Math.round(xx), Math.round(oy - gh2 / 2), 1, gh2);
      px(x - w / 2, y - h / 2, w, 2, '#cfc4ae');
    }
    const tower = (x, y, s, roof) => {
      px(x - s / 2 - 1, y - s / 2 + 2, s + 2, s, 'rgba(20,20,16,0.3)');
      px(x - s / 2, y - s / 2, s, s, '#a0957f');
      for (let yy = y - s / 2; yy < y + s / 2; yy += 4) px(x - s / 2, yy, s, 1, '#857b67');
      px(x - s / 2 + 1, y - s / 2 - 4, s - 2, 7, roof); px(x - s / 2 + 1, y - s / 2 - 4, s - 2, 2, sh(roof, 0.8));
    };
    for (const D of A.DISTRICTS) {
      gate(D.gx - D.nx * 2, D.gy - D.ny * 2, D.nx, D.ny, 34);
      gate(D.cx, D.cy, D.nx, D.ny, 26);
      decor.labels.push({ x: D.gx + D.nx * 70, y: D.gy + D.ny * 70 - (D.ny < 0 ? 10 : 0), text: `${D.name}`, size: 2, sub: `район, ${D.dir}` });
      decor.flags.push({ x: D.gx + D.ny * 24, y: D.gy - 30 + D.nx * 0, col: '#8e3b2f' });
    }
    for (const D of A.SINA_D) { gate(D.gx - D.nx * 2, D.gy - D.ny * 2, D.nx, D.ny, 22); decor.labels.push({ x: D.gx + D.nx * 48, y: D.gy + D.ny * 48, text: D.name, size: 1 }); }
    for (const D of A.MARIA_D) {
      gate(D.gx - D.nx * 2, D.gy - D.ny * 2, D.nx, D.ny, 22, D.breached);
      if (D.breached) gate(D.cx, D.cy, D.nx, D.ny, 18, true);
      if (D.name) decor.labels.push({ x: D.gx + D.nx * 60, y: D.gy + D.ny * 40, text: D.name, size: 2, sub: 'пролом' });
    }
    // башни и пушки по кольцу Розы
    for (let a = 0; a < 360; a += 15) {
      const rad = a * D2R, x = C.x + Math.cos(rad) * R.rose, y = C.y + Math.sin(rad) * R.rose;
      if (A.DISTRICTS.some((q) => Math.hypot(x - q.cx, y - q.cy) < q.r + 20)) continue;
      tower(Math.round(x), Math.round(y), 22, '#4f5a68');
      decor.flags.push({ x: Math.round(x), y: Math.round(y) - 18, col: '#8e3b2f' });
    }
    for (let a = 0; a < 360; a += 30) { const rad = a * D2R; tower(Math.round(C.x + Math.cos(rad) * R.sina), Math.round(C.y + Math.sin(rad) * R.sina), 16, '#3d5a7a'); }
    function cannonAt(x, y, nx, ny) {
      x = Math.round(x); y = Math.round(y);
      px(x - 2, y - 2, 5, 4, '#6b4a2c');
      for (let k = 0; k < 5; k++) px(x + Math.round(nx * k), y + Math.round(ny * k) - 1, 2, 2, '#2a2a2e');
      decor.cannons.push({ x, y, nx, ny });
    }
    // по кольцу
    for (let a = 0; a < 360; a += 3.6) {
      const rad = a * D2R, nx = Math.cos(rad), ny = Math.sin(rad);
      const x = C.x + nx * (R.rose + T.rose / 2 - 5), y = C.y + ny * (R.rose + T.rose / 2 - 5);
      if (A.DISTRICTS.some((q) => Math.hypot(x - q.cx, y - q.cy) < q.r + 6)) continue;
      cannonAt(x, y, nx, ny);
    }
    // по выступам районов
    for (const D of A.DISTRICTS) {
      for (let a = -150; a <= 150; a += 14) {
        const rad = D.ang + a * D2R, nx = Math.cos(rad), ny = Math.sin(rad);
        const x = D.cx + nx * (D.r + T.rose / 2 - 5), y = D.cy + ny * (D.r + T.rose / 2 - 5);
        if (A.rFromC(x, y) < R.rose + 6) continue;
        if (Math.hypot(x - D.gx, y - D.gy) < 26) continue;
        cannonAt(x, y, nx, ny);
      }
    }
    // склады и валуны
    for (const s of A.SUPPLY) {
      px(s.x - 18, s.y - 14, 36, 28, '#9e9178');
      px(s.x - 16, s.y - 12, 14, 10, '#cfc2a0'); px(s.x - 16, s.y - 12, 14, 2, '#a4987a');
      for (let k = 0; k < 6; k++) { const gx = s.x + (k % 3) * 4, gy = s.y - 6 + Math.floor(k / 3) * 8; px(gx, gy - 5, 3, 5, '#b8c0c8'); px(gx, gy - 5, 1, 5, '#e6ecf0'); }
      crate(s.x - 14, s.y + 12); crate(s.x - 9, s.y + 12); barrel(s.x + 12, s.y + 12);
      px(s.x + 14, s.y - 22, 1, 12, '#5a4a38'); decor.flags.push({ x: s.x + 15, y: s.y - 22, col: '#c9a24a' });
    }
    for (const b of A.BOULDERS) { ellOn(c, Math.round(b.x + 6), Math.round(b.y + 4), 16, 5, 'rgba(0,0,0,0.3)'); discOn(c, Math.round(b.x), Math.round(b.y - 8), 13, '#8a857c', true, true); }

    // подписи регионов
    decor.labels.push({ x: C.x, y: C.y - R.maria + 70, text: 'СТЕНА МАРИЯ', size: 2, wall: true });
    decor.labels.push({ x: C.x - 420, y: C.y - R.rose + 120, text: 'СТЕНА РОЗА', size: 2, wall: true });
    decor.labels.push({ x: C.x + 240, y: C.y - R.sina + 70, text: 'СТЕНА СИНА', size: 2, wall: true });
    decor.labels.push({ x: FORESTS[0].x, y: FORESTS[0].y - FORESTS[0].ry - 10, text: FORESTS[0].name, size: 1 });
    decor.labels.push({ x: FORESTS[5].x, y: FORESTS[5].y + FORESTS[5].ry + 18, text: FORESTS[5].name, size: 1 });
    decor.labels.push({ x: C.x + 1120, y: C.y - 1620, text: 'ОСТРОВ ПАРАДИЗ', size: 3 });

    // жители
    for (let k = 0; k < 900; k++) {
      const s = rp(decor.streets);
      decor.people.push({ s, p: r(), v: rf(0.01, 0.03) * (r() < 0.5 ? -1 : 1), col: rp(['#c84a4a', '#3d6fa8', '#d9b74a', '#efe6d0', '#5a8a46', '#8a5a9a', '#6b4a2c']), off: rf(-4, 4) });
    }

    // мини-карта
    const mini = document.createElement('canvas');
    mini.width = 300; mini.height = Math.round(300 * W.H / W.W);
    const mc = mini.getContext('2d');
    mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high';
    mc.drawImage(cv, 0, 0, mini.width, mini.height);

    // зона высадки (низкое разрешение)
    const dz = document.createElement('canvas');
    dz.width = Math.ceil(W.W / 8); dz.height = Math.ceil(W.H / 8);
    const dc = dz.getContext('2d');
    for (let y = 0; y < dz.height; y++) for (let x = 0; x < dz.width; x++) {
      const X = x * 8 + 4, Y = y * 8 + 4;
      const code = gcode(X, Y);
      if (code === 5) continue;
      const sd = A.sdRose(X, Y);
      if (sd > A.DEPLOY_OUT || code === 4) { dc.fillStyle = 'rgba(170,30,20,0.28)'; dc.fillRect(x, y, 1, 1); }
    }

    A.bg = cv; A.decor = decor; A.miniBg = mini; A.deployMask = dz;
  };
})(window.AOT);
