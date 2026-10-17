// Процедурные пиксельные спрайты титанов (двойная плотность пикселей) и значки карточек.
// Каждый вид — своё телосложение, рост и палитра. Рост в мире: 1 м ≈ 2 px.
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const S = 2; // пикселей спрайта на пиксель мира
  A.SPRITE_SCALE = S;

  const hx = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mul = (c, k) => [Math.min(255, c[0] * k) | 0, Math.min(255, c[1] * k) | 0, Math.min(255, c[2] * k) | 0];

  const SKINS = ['#e6b796', '#d9a07c', '#c98c6a', '#efc6a6', '#b97a5a', '#dcae8c', '#c4906e', '#e8c0a4'];
  const HAIRS = ['#2a2018', '#3d2a1c', '#5a3a22', '#1c1c20', '#6b5a3a', '#4a3a30', '#7a4a2a', '#8a7a5a'];
  const HAIR_STYLES = ['bald', 'short', 'mop', 'long', 'short', 'shaggy', 'bald', 'mop'];

  // Телосложения (доли роста). arm — длина руки относительно туловища, armT/legT — толщина.
  const BUILD = {
    small:    { head: 0.29, torso: 0.33, sh: 0.86, hip: 0.82, arm: 0.95, armT: 1.05, legT: 1.1, mouth: 'grin', eyes: 'dot' },
    normal:   { head: 0.20, torso: 0.37, sh: 0.95, hip: 0.82, arm: 1.0, armT: 1, legT: 1, mouth: 'grin', eyes: 'dot' },
    deviant:  { head: 0.17, torso: 0.33, sh: 0.78, hip: 0.62, arm: 1.5, armT: 0.75, legT: 0.75, mouth: 'gape', eyes: 'wide', lean: 0.12, ribs: true },
    // Шифтеры — оригинальные образы, выросшие из их способностей в игре:
    // Челюстной — полосатый хищник-бегун; Женская особь — фарфоровая кожа с гранями кристалла;
    // Бронированный — каменная корка (осыпается под копьями); Звероподобный — сгорбленный метатель
    // с костяным гребнем; Колоссальный — обугленный великан с тлеющими трещинами и паровыми клапанами.
    jaw:      { head: 0.24, torso: 0.36, sh: 1.0, hip: 0.7, arm: 1.12, armT: 1.0, legT: 1.0, mouth: 'shut', eyes: 'glow', crouch: 0.1, abs: true,
                skin: '#8a5a3e', hair: '#141010', style: 'shaggy', eyeCol: '#ffcc4a', theme: 'striped', outline: '#120c08' },
    female:   { head: 0.14, torso: 0.36, sh: 0.74, hip: 0.72, arm: 1.02, armT: 0.85, legT: 0.9, mouth: 'shut', eyes: 'glow', eyeCol: '#7fe0ff', abs: true,
                skin: '#e6e2ec', hair: '#3a2448', style: 'bun', theme: 'facet', outline: '#2a2434' },
    armored:  { head: 0.14, torso: 0.41, sh: 1.12, hip: 0.86, arm: 1.0, armT: 1.35, legT: 1.3, mouth: 'shut', eyes: 'glow', eyeCol: '#9fdcff', neckT: 1.6,
                skin: '#6a5a50', hair: '#2a2420', style: 'bald', theme: 'stone', outline: '#16130f' },
    beast:    { head: 0.12, torso: 0.40, sh: 1.15, hip: 0.74, arm: 1.55, armT: 1.2, legT: 1.05, mouth: 'shut', eyes: 'glow', eyeCol: '#e8d040', bigHands: true,
                crouch: 0.1, sinkHead: true, skin: '#8c9580', hair: '#2a2420', style: 'bald', theme: 'hide', outline: '#181c14' },
    colossal: { head: 0.13, torso: 0.40, sh: 0.92, hip: 0.74, arm: 1.02, armT: 1.0, legT: 1.0, mouth: 'shut', eyes: 'glow', eyeCol: '#ffb040', delts: true,
                skin: '#3d3431', hair: '#1a1412', style: 'bald', theme: 'ember', outline: '#140a06' },
    eren:     { head: 0.15, torso: 0.40, sh: 0.92, hip: 0.75, arm: 1.05, armT: 1.05, legT: 1.05, mouth: 'shut', eyes: 'fierce', abs: true,
                skin: '#d6a688', hair: '#2a1e16', style: 'short' },
  };
  const EREN_DEF = { h: 30, w: 12 };

  function make(type, variant, H, Wd, frame, lvl) {
    const b0 = BUILD[type];
    const b = Object.assign({}, b0);
    const rv = (k) => A.hash(variant, k, 77);
    if (!b0.skin) { // обычные титаны — каждый со своим лицом и фигурой
      b.skin = SKINS[variant % SKINS.length];
      b.hair = HAIRS[(variant * 5 + 3) % HAIRS.length];
      b.style = HAIR_STYLES[(variant * 3) % HAIR_STYLES.length];
      b.belly = type === 'deviant' ? 0 : rv(1) < 0.45 ? 0.15 + rv(2) * 0.35 : 0;
      b.sh *= 0.9 + rv(3) * 0.2;
      b.head *= 0.9 + rv(4) * 0.25;
      b.arm *= 0.92 + rv(5) * 0.16;
      if (type === 'normal' && rv(6) < 0.3) b.mouth = 'blank';
    }
    const h = Math.round(H * S), w = Math.round(Wd * S);
    const cw = Math.ceil(w * 2.3) + 6, ch = h + 4 + Math.ceil(h * (b.sinkHead ? 0.55 : 0.14)); // запас сверху для замаха
    const buf = new Uint8ClampedArray(cw * ch * 4);
    const put = (x, y, c, a) => {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= cw || y >= ch) return;
      const i = (y * cw + x) * 4;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = a == null ? 255 : a;
    };
    const has = (x, y) => x >= 0 && y >= 0 && x < cw && y < ch && buf[(y * cw + x) * 4 + 3] > 0;
    const skin = hx(b.skin), hair = hx(b.hair);
    const sc = Math.max(1, h / 60); // масштаб деталей

    // капсула (конечность) с объёмным светом слева
    function capsule(x1, y1, x2, y2, r1, r2, col, dark) {
      const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.ceil(L));
      for (let s = 0; s <= n; s++) {
        const t = s / n, cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t, r = r1 + (r2 - r1) * t;
        const R = Math.ceil(r);
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > r * r + 0.3) continue;
          const k = (dark ? 0.86 : 1.08) - 0.3 * ((dx / (r + 0.01)) + 1) / 2 - (dy > r * 0.6 ? 0.06 : 0);
          put(cx + dx, cy + dy, mul(col, k));
        }
      }
    }
    function ellipse(cx, cy, rx, ry, col, taper) {
      for (let dy = -Math.ceil(ry); dy <= ry; dy++) {
        let rr = rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)));
        if (taper && dy > 0) rr *= 1 - taper * (dy / ry);
        for (let dx = -Math.ceil(rr); dx <= rr; dx++) {
          const k = 1.08 - 0.3 * ((dx / (rr + 0.01)) + 1) / 2;
          put(cx + dx, cy + dy, mul(col, k));
        }
      }
    }
    // линия-деталь: смешивается с кожей под ней (не делает дыр)
    const line = (x1, y1, x2, y2, col, a) => {
      const L = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1), k = (a == null ? 255 : a) / 255;
      for (let s = 0; s <= L; s++) {
        const x = Math.round(x1 + (x2 - x1) * s / L), y = Math.round(y1 + (y2 - y1) * s / L);
        if (!has(x, y)) continue;
        const i = (y * cw + x) * 4;
        put(x, y, [buf[i] * (1 - k) + col[0] * k, buf[i + 1] * (1 - k) + col[1] * k, buf[i + 2] * (1 - k) + col[2] * k]);
      }
    };

    // ---- пропорции ----
    const cx = cw / 2, ground = ch - 2;
    const crouch = b.crouch || 0;
    const headH = h * b.head, neckH = Math.max(1, h * 0.03), torsoH = h * b.torso;
    const legH = (h - headH - neckH - torsoH) * (1 - crouch);
    const shW = w * b.sh, hipW = w * b.hip;
    const yHip = ground - legH, ySh = yHip - torsoH, yNeck = ySh - neckH;
    const headW = Math.max(3, headH * (type === 'small' ? 0.95 : 0.78));
    const headCy = b.sinkHead ? ySh + headH * 0.12 : yNeck - headH / 2 + 1; // у метателя голова утоплена в плечи
    const lean = (b.lean || 0) * h * (variant % 2 ? 1 : -1);
    const dark = mul(skin, 0.62);

    // ---- ноги ----
    const thighR = Math.max(1.2, hipW * 0.21 * b.legT), calfR = thighR * 0.72, ankleR = thighR * 0.48;
    for (const s of [-1, 1]) {
      const step = frame === 2 ? 0 : (frame === 0 ? s : -s);
      const hx0 = cx + s * hipW * 0.27;
      const fx = cx + s * (hipW * 0.3 + crouch * w * 0.5) + step * w * 0.04;
      const fy = ground - (step > 0 ? sc * 2 : 0);
      const kx = (hx0 + fx) / 2 + s * crouch * w * 0.35, ky = yHip + legH * 0.48 - (step > 0 ? sc * 2 : 0);
      capsule(hx0, yHip, kx, ky, thighR, calfR, skin, s > 0);
      capsule(kx, ky, fx, fy - ankleR, calfR, ankleR, skin, s > 0);
      // ступня
      for (let i = 0; i < Math.max(2, ankleR * 2.6); i++) for (let j = 0; j < Math.max(1, ankleR * 0.9); j++) put(fx - ankleR + i + s * 0.5, fy - j, mul(skin, s > 0 ? 0.72 : 0.84));
      // колено
      if (sc > 1.2) line(kx - calfR * 0.5, ky, kx + calfR * 0.3, ky + 1, dark, 160);
    }

    // ---- туловище ----
    const waistW = Math.min(shW, hipW) * 0.86;
    for (let i = 0; i <= torsoH; i++) {
      const k = i / torsoH;
      let rw = k < 0.6 ? shW + (waistW - shW) * (k / 0.6) : waistW + (hipW - waistW) * ((k - 0.6) / 0.4);
      if (b.belly && k > 0.4) rw += Math.sin(((k - 0.4) / 0.6) * Math.PI) * w * b.belly;
      const y = ySh + i, ox = cx + lean * (1 - k);
      for (let x = -rw / 2; x <= rw / 2; x++) {
        const kk = 1.08 - 0.3 * ((x / (rw / 2)) + 1) / 2;
        put(ox + x, y, mul(skin, kk));
      }
    }
    // детали торса
    const tc = cx + lean * 0.5;
    if (sc >= 1.3) {
      const py = ySh + torsoH * 0.3;
      line(tc - shW * 0.32, py, tc - shW * 0.04, py + sc, dark, 150); // грудь
      line(tc + shW * 0.04, py + sc, tc + shW * 0.32, py, dark, 170);
      line(tc - shW * 0.3, ySh + sc * 1.5, tc - shW * 0.05, ySh + sc * 2.5, mul(skin, 0.8), 140); // ключицы
      line(tc + shW * 0.05, ySh + sc * 2.5, tc + shW * 0.3, ySh + sc * 1.5, mul(skin, 0.8), 140);
      if (b.abs && sc >= 2) {
        line(tc, py + sc * 2, tc, ySh + torsoH * 0.82, mul(skin, 0.78), 130);
        for (let r = 0; r < 3; r++) { const ay = py + sc * 3 + r * torsoH * 0.13; line(tc - waistW * 0.22, ay, tc + waistW * 0.22, ay, mul(skin, 0.8), 110); }
      }
      if (b.ribs && sc >= 1.5) for (let r = 0; r < 4; r++) { const ry = py + sc * 2 + r * sc * 2.2; line(tc - shW * 0.38, ry, tc - shW * 0.2, ry + sc, mul(skin, 0.78), 130); line(tc + shW * 0.2, ry + sc, tc + shW * 0.38, ry, mul(skin, 0.72), 130); }
    }
    put(tc, ySh + torsoH * 0.72, dark); // пупок
    if (sc >= 2) line(tc, yHip - sc * 2, tc, yHip + legH * 0.15, mul(skin, 0.7), 170); // промежность
    if (b.belly && sc >= 1.2) line(tc - w * b.belly * 0.6, ySh + torsoH * 0.88, tc + w * b.belly * 0.6, ySh + torsoH * 0.88, mul(skin, 0.75), 130);

    // ---- руки ----
    const armLen = torsoH * b.arm;
    const upR = Math.max(1, shW * 0.13 * b.armT), foreR = upR * 0.85, wristR = upR * 0.6;
    for (const s of [-1, 1]) {
      const sx = cx + lean + s * (shW / 2 - upR * 0.4), sy = ySh + upR * 0.8;
      let ex, ey, hx2, hy2;
      if (frame === 2) { // замах: тянется вперёд-вверх
        ex = sx + s * upR * 1.2; ey = sy - armLen * 0.28;
        hx2 = sx - s * upR * 0.6; hy2 = sy - armLen * 0.62;
      } else {
        const sw = (frame === 0 ? s : -s) * armLen * 0.07;
        ex = sx + s * upR * 0.9 + (crouch ? s * w * 0.15 : 0); ey = sy + armLen * 0.48;
        hx2 = sx + s * upR * 0.7 + sw + (crouch ? s * w * 0.2 : 0); hy2 = sy + armLen;
        if (crouch) hy2 = Math.min(hy2, ground - wristR * 2);
      }
      capsule(sx, sy, ex, ey, upR, foreR, skin, s > 0);
      if (b.delts && sc >= 2) line(sx - s * upR * 0.9, sy + upR * 1.1, sx + s * upR * 0.6, sy + upR * 1.4, mul(skin, 0.75), 150); // дельты
      capsule(ex, ey, hx2, hy2, foreR, wristR, skin, s > 0);
      const handR = wristR * (b.bigHands ? 1.9 : 1.35);
      ellipse(hx2, hy2 + handR * 0.6, handR, handR * 1.15, mul(skin, s > 0 ? 0.86 : 0.98));
      if (sc >= 1.5) for (let f = -1; f <= 1; f++) line(hx2 + f * handR * 0.45, hy2 + handR * 0.8, hx2 + f * handR * 0.5, hy2 + handR * 1.7, dark, 150); // пальцы
      if (sc >= 1.6) put(ex + s * foreR * 0.4, ey, dark); // локоть
    }

    // костяной гребень на загривке метателя
    if (b.theme === 'hide') {
      const bone = hx('#e2d6b8'), n = 7;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), sx = cx - shW * 0.42 + t * shW * 0.84;
        const sh = headH * (0.55 + 0.45 * Math.sin(t * Math.PI)) * 0.9, bw = Math.max(1.5, shW * 0.06);
        for (let y = 0; y < sh; y++) { const ww = bw * (1 - y / sh); for (let x = -ww; x <= ww; x++) put(sx + x, ySh + 1 - y, mul(bone, x < 0 ? 1.05 : 0.8)); }
      }
    }
    // ---- шея и голова ----
    const neckR = Math.max(1, headW * 0.28 * (b.neckT || 1));
    if (!b.sinkHead) capsule(cx + lean, ySh + 1, cx + lean, yNeck - 1, neckR, neckR, skin, false);
    const hcx = cx + lean * 1.1 + (crouch ? 0 : 0);
    // уши
    ellipse(hcx - headW / 2, headCy + headH * 0.05, Math.max(1, headW * 0.09), Math.max(1, headH * 0.12), mul(skin, 0.9));
    ellipse(hcx + headW / 2, headCy + headH * 0.05, Math.max(1, headW * 0.09), Math.max(1, headH * 0.12), mul(skin, 0.75));
    ellipse(hcx, headCy, headW / 2, headH / 2, skin, 0.28);

    // волосы
    const style = b.style;
    const top = headCy - headH / 2;
    if (style !== 'bald') {
      const hh = style === 'mop' || style === 'shaggy' ? 0.42 : style === 'bob' ? 0.38 : style === 'bun' ? 0.24 : 0.28;
      if (style === 'bun') ellipse(hcx, top - headH * 0.12, headW * 0.22, headH * 0.14, mul(hair, 1.1));
      for (let y = 0; y < headH * hh; y++) {
        const k = y / (headH / 2);
        const rr = (headW / 2 + 1) * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)));
        for (let x = -rr; x <= rr; x++) {
          const kk = 1.1 - 0.35 * ((x / (rr + 0.01)) + 1) / 2;
          put(hcx + x, top + y - 1, mul(hair, A.hash(x | 0, y | 0, variant) > 0.85 ? kk * 0.8 : kk));
        }
      }
      const sideLen = { long: 0.95, bob: 0.62, shaggy: 0.7, mop: 0.45, short: 0.2 }[style] || 0;
      if (sideLen) for (const s of [-1, 1]) for (let y = 0; y < headH * sideLen; y++) {
        const wdt = Math.max(1, headW * 0.14 * (style === 'shaggy' ? 1.3 : 1));
        for (let x = 0; x < wdt; x++) {
          const jag = style === 'shaggy' && y > headH * sideLen - 3 && (x + y) % 2;
          if (!jag) put(hcx + s * (headW / 2 - x + 0.5), top + headH * 0.2 + y, mul(hair, s > 0 ? 0.8 : 1));
        }
      }
      if (style === 'long') for (let y = 0; y < headH * 0.5; y++) for (let x = -headW * 0.35; x <= headW * 0.35; x++) if (!has(hcx + x, yNeck + y)) put(hcx + x, yNeck + y, mul(hair, 0.7)); // волосы за спиной
    } else if (sc >= 1.5) {
      ellipse(hcx - headW * 0.18, top + headH * 0.18, headW * 0.12, headH * 0.06, mul(skin, 1.12)); // блик на лысине
    }

    // лицо
    const ey = headCy + headH * 0.02, ex = headW * 0.21;
    const eyeW = Math.max(1, Math.round(headW * 0.12)), eyeH = Math.max(1, Math.round(headH * 0.07));
    for (const s of [-1, 1]) {
      const exx = hcx + s * ex - eyeW / 2;
      if (b.eyes === 'glow') { for (let i = 0; i < eyeW; i++) for (let j = 0; j < eyeH; j++) put(exx + i, ey + j, hx(b.eyeCol)); }
      else if (eyeW >= 3 && b.eyes !== 'dot') {
        for (let i = 0; i < eyeW; i++) for (let j = 0; j < eyeH; j++) put(exx + i, ey + j, b.eyes === 'wide' ? [240, 236, 220] : [226, 220, 206]);
        const pw = Math.max(1, eyeW * (b.eyes === 'wide' ? 0.35 : 0.45));
        for (let i = 0; i < pw; i++) for (let j = 0; j < eyeH; j++) put(exx + eyeW / 2 - pw / 2 + i + s * (b.eyes === 'wide' ? -1 : 0), ey + j, [26, 18, 16]);
      } else {
        for (let i = 0; i < eyeW; i++) for (let j = 0; j < eyeH; j++) put(exx + i, ey + j, [26, 18, 16]);
      }
      // брови
      const bw = eyeW + Math.max(1, sc * 0.5), byy = ey - Math.max(1, eyeH);
      const tilt = b.eyes === 'fierce' || b.eyes === 'stern' ? s * -1 : 0;
      for (let i = 0; i < bw; i++) put(exx - 0.5 + i, byy + (tilt > 0 ? i / bw : tilt < 0 ? 1 - i / bw : 0) * Math.max(1, sc * 0.6), b.brow ? mul(skin, 0.55) : mul(hair, 0.9));
      if (b.brow && sc >= 3) line(hcx + s * ex - eyeW, byy - 1, hcx + s * ex + eyeW, byy - 1, mul(skin, 0.6), 200);
    }
    // нос
    const ny = headCy + headH * 0.14;
    if (sc >= 1.3) { line(hcx + 1, ey + eyeH, hcx + 1, ny, mul(skin, 0.78), 200); put(hcx - 1, ny, mul(skin, 0.7)); put(hcx + 1, ny, mul(skin, 0.7)); }
    // рот
    const my = headCy + headH * 0.29;
    const mw = b.mouth === 'grin' ? headW * 0.62 : b.mouth === 'gape' ? headW * 0.34 : headW * 0.26;
    if (b.mouth === 'grin') {
      for (let x = -mw / 2; x <= mw / 2; x++) { const curve = Math.round(Math.abs(x) / (mw / 2) * -Math.max(1, sc * 0.6)); put(hcx + x, my + curve, [70, 26, 22]); if (sc >= 1.2 && (Math.round(x) & 1)) put(hcx + x, my + curve - 1, [238, 230, 210]); }
    } else if (b.mouth === 'gape' || frame === 2) {
      const mh = Math.max(2, headH * (b.mouth === 'gape' ? 0.14 : 0.08));
      for (let x = -mw / 2; x <= mw / 2; x++) for (let y = 0; y < mh; y++) put(hcx + x, my + y - 1, y === 0 && sc >= 1.5 && (Math.round(x) & 1) ? [238, 230, 210] : [60, 20, 18]);
    } else if (b.mouth === 'blank') {
      put(hcx, my, mul(skin, 0.6));
    } else {
      for (let x = -mw / 2; x <= mw / 2; x++) put(hcx + x, my, mul(skin, 0.55));
    }
    // скулы и подбородок
    if (sc >= 2.5) { line(hcx - headW * 0.36, ny, hcx - headW * 0.26, my + 2, mul(skin, 0.86), 120); line(hcx + headW * 0.26, my + 2, hcx + headW * 0.36, ny, mul(skin, 0.8), 140); }

    // ---- метатель держит валун над головой при броске ----
    if (b.theme === 'hide' && frame === 2) {
      const br = Math.max(3, shW * 0.36), by = ySh - torsoH * b.arm * 0.62 - br * 0.4;
      ellipse(cx + lean, by, br, br * 0.85, hx('#8a857c'));
      line(cx - br * 0.4, by - br * 0.2, cx + br * 0.1, by + br * 0.3, hx('#5e5a52'), 200);
    }

    // ---- оригинальные «шкуры» шифтеров ----
    const glowBuf = b.theme === 'ember' ? new Uint8ClampedArray(cw * ch * 4) : null;
    const body = new Uint8Array(cw * ch);
    let bodyN = 0;
    for (let k = 0; k < cw * ch; k++) if (buf[k * 4 + 3]) { body[k] = 1; bodyN++; }
    const isB = (x, y) => x >= 0 && y >= 0 && x < cw && y < ch && body[y * cw + x];
    const skinSum = skin[0] + skin[1] + skin[2] || 1;
    const faceBox = (x, y) => Math.abs(x - hcx) < headW * 0.42 && y > ey - eyeH - 1 && y < ey + eyeH * 2;
    const blend = (x, y, c, k) => { const i = (y * cw + x) * 4; put(x, y, [buf[i] * (1 - k) + c[0] * k, buf[i + 1] * (1 - k) + c[1] * k, buf[i + 2] * (1 - k) + c[2] * k]); };
    if (b.theme === 'stone') {
      // каменная корка из неровных плит; lvl 3 — целая, 0 — осыпалась
      const cs = Math.max(4, Math.round(h / 8)), frac = (lvl == null ? 3 : lvl) / 3;
      const STONES = ['#857b6c', '#93897a', '#776f63', '#9c917c', '#6f6a5e'].map(hx), seam = hx('#2e2822'), moss = hx('#5f7040');
      const cellOf = (x, y) => { const qy = Math.floor((y + Math.sin(x * 0.21) * cs * 0.3) / (cs * 0.8)); return [Math.floor((x + (qy % 2) * cs * 0.5 + Math.sin(y * 0.19 + qy) * cs * 0.3) / cs), qy]; };
      const src = new Uint8ClampedArray(buf);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        if (!isB(x, y) || faceBox(x, y)) continue;
        const [qx, qy] = cellOf(x, y);
        if (A.hash(qx, qy, 51) >= frac) continue; // эта плита уже отвалилась
        const i = (y * cw + x) * 4, f = Math.max(0.6, Math.min(1.25, (src[i] + src[i + 1] + src[i + 2]) / skinSum));
        let c = mul(STONES[(A.hash(qx, qy, 52) * STONES.length) | 0], f * (0.95 + 0.1 * A.hash(qx, qy, 53)));
        const [rx, ry] = isB(x + 1, y) ? cellOf(x + 1, y) : [qx, qy], [dx2, dy2] = isB(x, y + 1) ? cellOf(x, y + 1) : [qx, qy];
        const [ux, uy] = isB(x, y - 1) ? cellOf(x, y - 1) : [qx, qy];
        if (rx !== qx || ry !== qy || dx2 !== qx || dy2 !== qy) c = seam;
        else if (ux !== qx || uy !== qy) c = mul(c, 1.25); // светлая кромка плиты
        else if (A.hash(x, y, 54) > 0.965) c = moss;
        put(x, y, c);
      }
    } else if (b.theme === 'ember') {
      // тлеющие трещины: рваные ветвящиеся разломы, светятся отдельным слоем
      const rnd = A.rng(variant * 977 + H * 13 + frame);
      const core = hx('#ffd36a'), hot = hx('#ff7a2a'), halo = hx('#8a2a14');
      const walkers = [];
      const nC = Math.max(4, Math.round(bodyN / 260));
      for (let i = 0; i < nC * 6 && walkers.length < nC; i++) {
        const x = (rnd() * cw) | 0, y = (rnd() * ch) | 0;
        if (isB(x, y) && !faceBox(x, y)) walkers.push({ x, y, a: rnd() * 6.28, n: (6 + rnd() * 18) * Math.max(1, sc / 2) });
      }
      const glowPut = (x, y, c, a) => { const i = (y * cw + x) * 4; if (glowBuf[i + 3] >= a) return; glowBuf[i] = c[0]; glowBuf[i + 1] = c[1]; glowBuf[i + 2] = c[2]; glowBuf[i + 3] = a; };
      while (walkers.length) {
        const w0 = walkers.pop();
        for (let st = 0; st < w0.n; st++) {
          w0.a += (rnd() - 0.5) * 1.1; w0.x += Math.cos(w0.a); w0.y += Math.sin(w0.a);
          const x = Math.round(w0.x), y = Math.round(w0.y);
          if (!isB(x, y)) break;
          put(x, y, st < w0.n * 0.7 ? core : hot); glowPut(x, y, [255, 196, 90], 255);
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isB(x + ox, y + oy)) { blend(x + ox, y + oy, halo, 0.45); glowPut(x + ox, y + oy, [255, 90, 30], 110); }
          if (rnd() < 0.06 && walkers.length < 40) walkers.push({ x: w0.x, y: w0.y, a: w0.a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd()), n: (w0.n - st) * 0.6 });
        }
      }
      // паровые клапаны на плечах и спине
      for (const s2 of [-1, 1]) {
        const vx = cx + s2 * shW * 0.3, vy = ySh + Math.max(2, sc * 2.5), vr = Math.max(1.5, shW * 0.05);
        ellipse(vx, vy, vr + 1, vr * 0.8 + 1, hot); ellipse(vx, vy, vr, vr * 0.7, [30, 16, 12]);
        for (let yy = -vr - 1; yy <= vr + 1; yy++) for (let xx = -vr - 1; xx <= vr + 1; xx++) if (isB(Math.round(vx + xx), Math.round(vy + yy))) glowPut(Math.round(vx + xx), Math.round(vy + yy), [255, 120, 40], 90);
      }
    } else if (b.theme === 'hide') {
      // пятнистая толстая шкура
      const cs = Math.max(3, Math.round(h / 12));
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        if (!isB(x, y) || faceBox(x, y)) continue;
        const n = A.hash(Math.floor((x + Math.sin(y * 0.5) * 2) / cs), Math.floor(y / cs), 61);
        if (n > 0.68) blend(x, y, mul(skin, 0.62), 0.55);
        else if (n < 0.08) blend(x, y, mul(skin, 1.2), 0.4);
      }
    } else if (b.theme === 'facet') {
      // гранёная кожа: тонкая решётка кристаллических граней, ярче на руках и голенях
      const cs = Math.max(4, Math.round(h / 9)), fc = hx('#7fc8ea');
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        if (!isB(x, y) || faceBox(x, y)) continue;
        const onL = (x + y) % cs === 0 || ((x - y) % cs + cs) % cs === 0;
        if (!onL) continue;
        const strong = y > yHip + legH * 0.45 || y > ySh + torsoH * b.arm * 0.5 && Math.abs(x - cx) > shW * 0.4;
        blend(x, y, fc, strong ? 0.75 : 0.45);
      }
      // кристаллические наросты на предплечьях и голенях
      const cry = hx('#bfeaff');
      const shard = (bx, by, s2, hgt) => { for (let yy = 0; yy < hgt; yy++) { const ww = Math.max(0.5, (hgt - yy) * 0.35); for (let xx = -ww; xx <= ww; xx++) put(bx + s2 * yy * 0.6 + xx, by - yy, mul(cry, xx < 0 ? 1.05 : 0.8)); } };
      const sh2 = Math.max(2, h / 14);
      for (const s2 of [-1, 1]) {
        shard(cx + s2 * hipW * 0.42, yHip + legH * 0.62, s2, sh2);
        shard(cx + s2 * (shW / 2 + upR * 0.8), ySh + torsoH * b.arm * 0.62, s2, sh2 * 0.9);
        shard(cx + s2 * shW * 0.45, ySh + 1, s2, sh2 * 0.8);
      }
    } else if (b.theme === 'striped') {
      // тигриные полосы хищника
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        if (!isB(x, y) || faceBox(x, y)) continue;
        if (Math.sin((x * 0.55 + y) / Math.max(1.1, h / 22)) > 0.45) blend(x, y, [24, 14, 10], 0.65);
      }
    }

    // ---- контур ----
    const out = new Uint8ClampedArray(buf);
    const OL = b.outline ? hx(b.outline) : [44, 26, 22];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      if (buf[i + 3]) continue;
      if (has(x - 1, y) || has(x + 1, y) || has(x, y - 1) || has(x, y + 1)) { out[i] = OL[0]; out[i + 1] = OL[1]; out[i + 2] = OL[2]; out[i + 3] = 230; }
    }
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    cv.getContext('2d').putImageData(new ImageData(out, cw, ch), 0, 0);
    cv.s = S;
    if (glowBuf) { const g = document.createElement('canvas'); g.width = cw; g.height = ch; g.getContext('2d').putImageData(new ImageData(glowBuf, cw, ch), 0, 0); cv.glow = g; }
    return cv;
  }

  const cache = {};
  A.titanSprite = function (type, variant, H, Wd, lvl) {
    if (type === 'eren') { H = EREN_DEF.h; Wd = EREN_DEF.w; }
    H = H || A.TITANS[type].h; Wd = Wd || A.TITANS[type].w;
    if (BUILD[type].theme) variant = 0; // у шифтеров один облик
    const key = type + ':' + variant + ':' + H + ':' + Wd + ':' + (lvl == null ? '' : lvl);
    if (!cache[key]) cache[key] = [0, 1, 2].map((f) => make(type, variant, H, Wd, f, lvl));
    return cache[key];
  };
  A.EREN_DEF = EREN_DEF;

  // ---------- Пиксельные значки для карточек без картинки ----------
  const ICONS = {
    blades: [
      '1.........1',
      '.1.......1.',
      '..1.....1..',
      '...1...1...',
      '....1.1....',
      '.....1.....',
      '....1.1....',
      '...2...2...',
      '..22...22..',
      '.2.......2.',
    ],
    cannon: [
      '...........',
      '.....11111.',
      '..11111111.',
      '.111111111.',
      '..11111111.',
      '.....11111.',
      '..2222.....',
      '.2....2....',
      '.2.22.2....',
      '..2222.....',
    ],
    star: [
      '.....1.....',
      '.....1.....',
      '....111....',
      '11111111111',
      '..1111111..',
      '...11111...',
      '...11.11...',
      '..11...11..',
      '..1.....1..',
      '...........',
    ],
  };
  A.drawIcon = function (canvas, name, col1, col2) {
    const m = ICONS[name];
    const c = canvas.getContext('2d');
    const s = Math.floor(Math.min(canvas.width / m[0].length, canvas.height / m.length));
    const ox = (canvas.width - s * m[0].length) / 2 | 0, oy = (canvas.height - s * m.length) / 2 | 0;
    c.clearRect(0, 0, canvas.width, canvas.height);
    m.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      c.fillStyle = ch === '1' ? col1 : col2;
      c.fillRect(ox + x * s, oy + y * s, s, s);
    }));
  };
})(window.AOT);
