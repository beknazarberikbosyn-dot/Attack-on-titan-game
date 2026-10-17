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
    jaw:      { head: 0.24, torso: 0.36, sh: 1.0, hip: 0.7, arm: 1.12, armT: 1.0, legT: 1.0, mouth: 'shut', eyes: 'glow', crouch: 0.1, abs: true,
                skin: '#9c6b52', hair: '#1c1612', style: 'shaggy', eyeCol: '#ffcc4a' },
    female:   { head: 0.14, torso: 0.36, sh: 0.74, hip: 0.72, arm: 1.02, armT: 0.85, legT: 0.9, mouth: 'shut', eyes: 'calm', abs: true,
                skin: '#e9c9b3', hair: '#5a2e22', style: 'bob' },
    armored:  { head: 0.14, torso: 0.41, sh: 1.12, hip: 0.86, arm: 1.0, armT: 1.35, legT: 1.3, mouth: 'shut', eyes: 'stern', abs: true, neckT: 1.6, delts: true,
                skin: '#b08a6e', hair: '#2a2420', style: 'bald' },
    beast:    { head: 0.13, torso: 0.40, sh: 1.0, hip: 0.78, arm: 1.42, armT: 1.15, legT: 1.1, mouth: 'shut', eyes: 'stern', bigHands: true,
                skin: '#c49a78', hair: '#6b4a2c', style: 'long' },
    colossal: { head: 0.13, torso: 0.40, sh: 0.92, hip: 0.74, arm: 1.02, armT: 1.0, legT: 1.0, mouth: 'shut', eyes: 'stern', abs: true, brow: true, delts: true,
                skin: '#d9c7b8', hair: '#3a302a', style: 'bald' },
    eren:     { head: 0.15, torso: 0.40, sh: 0.92, hip: 0.75, arm: 1.05, armT: 1.05, legT: 1.05, mouth: 'shut', eyes: 'fierce', abs: true,
                skin: '#d6a688', hair: '#2a1e16', style: 'short' },
  };
  const EREN_DEF = { h: 30, w: 12 };

  function make(type, variant, H, Wd, frame) {
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
    const cw = Math.ceil(w * 2.3) + 6, ch = h + 4;
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
    const headCy = yNeck - headH / 2 + 1;
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

    // ---- шея и голова ----
    const neckR = Math.max(1, headW * 0.28 * (b.neckT || 1));
    capsule(cx + lean, ySh + 1, cx + lean, yNeck - 1, neckR, neckR, skin, false);
    const hcx = cx + lean * 1.1 + (crouch ? 0 : 0);
    // уши
    ellipse(hcx - headW / 2, headCy + headH * 0.05, Math.max(1, headW * 0.09), Math.max(1, headH * 0.12), mul(skin, 0.9));
    ellipse(hcx + headW / 2, headCy + headH * 0.05, Math.max(1, headW * 0.09), Math.max(1, headH * 0.12), mul(skin, 0.75));
    ellipse(hcx, headCy, headW / 2, headH / 2, skin, 0.28);

    // волосы
    const style = b.style;
    const top = headCy - headH / 2;
    if (style !== 'bald') {
      const hh = style === 'mop' || style === 'shaggy' ? 0.42 : style === 'bob' ? 0.38 : 0.28;
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

    // ---- контур ----
    const out = new Uint8ClampedArray(buf);
    const OL = type === 'jaw' || type === 'armored' ? [26, 18, 14] : [44, 26, 22];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      if (buf[i + 3]) continue;
      if (has(x - 1, y) || has(x + 1, y) || has(x, y - 1) || has(x, y + 1)) { out[i] = OL[0]; out[i + 1] = OL[1]; out[i + 2] = OL[2]; out[i + 3] = 230; }
    }
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    cv.getContext('2d').putImageData(new ImageData(out, cw, ch), 0, 0);
    cv.s = S;
    return cv;
  }

  const cache = {};
  A.titanSprite = function (type, variant, H, Wd) {
    if (type === 'eren') { H = EREN_DEF.h; Wd = EREN_DEF.w; }
    H = H || A.TITANS[type].h; Wd = Wd || A.TITANS[type].w;
    const key = type + ':' + variant + ':' + H + ':' + Wd;
    if (!cache[key]) cache[key] = [make(type, variant, H, Wd, 0), make(type, variant, H, Wd, 1), make(type, variant, H, Wd, 2)];
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
