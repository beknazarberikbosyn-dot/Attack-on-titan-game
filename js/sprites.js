// Процедурные пиксельные спрайты: титаны (обобщённые гиганты) и значки для карточек
window.AOT = window.AOT || {};
(function (A) {
  'use strict';

  const SKINS = ['#e6b796', '#d9a07c', '#c98c6a', '#efc6a6', '#b97a5a', '#dcae8c'];
  const HAIRS = ['#2a2018', '#3d2a1c', '#5a3a22', '#1c1c20', '#6b5a3a', '#4a3a30'];

  // Пропорции фигуры (доли высоты). Никаких «фирменных» черт — только силуэт.
  const PROPS = {
    small:    { head: 0.30, torso: 0.32, sh: 0.9, hip: 0.75, arm: 0.95, hw: 0.95, grin: true, belly: 0.5 },
    normal:   { head: 0.21, torso: 0.38, sh: 0.95, hip: 0.8, arm: 1.0, hw: 0.8, grin: true, belly: 0.5 },
    deviant:  { head: 0.16, torso: 0.34, sh: 0.8, hip: 0.6, arm: 1.45, hw: 0.75, grin: true, belly: 0 },
    jaw:      { head: 0.24, torso: 0.44, sh: 1.0, hip: 0.75, arm: 1.2, hw: 0.8, grin: false, belly: 0, crouch: true },
    female:   { head: 0.15, torso: 0.37, sh: 0.78, hip: 0.72, arm: 1.05, hw: 0.75, grin: false, belly: 0 },
    armored:  { head: 0.15, torso: 0.42, sh: 1.0, hip: 0.85, arm: 1.0, hw: 0.7, grin: false, belly: 0 },
    beast:    { head: 0.14, torso: 0.40, sh: 0.95, hip: 0.75, arm: 1.55, hw: 0.75, grin: false, belly: 0 },
    colossal: { head: 0.14, torso: 0.40, sh: 1.0, hip: 0.8, arm: 1.05, hw: 0.7, grin: false, belly: 0 },
    eren:     { head: 0.15, torso: 0.40, sh: 0.92, hip: 0.75, arm: 1.05, hw: 0.72, grin: false, belly: 0 },
  };
  const EREN_DEF = { h: 30, w: 13 };

  function make(type, variant, frame) {
    const def = type === 'eren' ? EREN_DEF : A.TITANS[type];
    const pr = PROPS[type];
    const H = def.h, Wd = def.w;
    const armExtra = Math.ceil(Wd * 0.5);
    const cw = Wd + armExtra * 2 + 2, ch = H + 1;
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d');
    const P = (x, y, w, h, col) => { if (w <= 0 || h <= 0) return; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const skin = type === 'eren' ? '#d8a486' : SKINS[variant % SKINS.length];
    const hair = type === 'eren' ? '#2a1e16' : HAIRS[(variant * 7) % HAIRS.length];
    const dark = A.shade(skin, 0.78), darker = A.shade(skin, 0.62), light = A.shade(skin, 1.08);
    const cx = cw / 2;

    let headH = Math.max(3, Math.round(H * pr.head));
    let torsoH = Math.max(3, Math.round(H * pr.torso));
    const legH = Math.max(2, H - headH - torsoH);
    const shW = Math.max(3, Math.round(Wd * pr.sh)), hipW = Math.max(3, Math.round(Wd * pr.hip));
    const headW = Math.max(3, Math.round(headH * pr.hw * (H < 20 ? 1.1 : 1)));
    const top = 1;
    const crouch = pr.crouch ? Math.round(H * 0.06) : 0;

    // ноги
    const legW = Math.max(1, Math.round(hipW * 0.42));
    const legTop = top + headH + torsoH;
    for (const s of [-1, 1]) {
      const step = frame === 1 ? s : frame === 0 ? -s : 0;
      const lift = step > 0 ? 1 : 0;
      const lx = cx + s * (hipW / 2 - legW / 2) - legW / 2 + step * 0.5;
      P(lx, legTop, legW, legH - lift, s < 0 ? skin : dark);
      P(lx, legTop + legH - lift - 1, legW + (s > 0 ? 1 : 0), 1, darker); // стопы
      if (legH > 6) P(lx, legTop + Math.round(legH * 0.45), legW, 1, darker); // колени
    }
    // туловище (трапеция)
    const tTop = top + headH + crouch;
    for (let i = 0; i < torsoH; i++) {
      const k = i / Math.max(1, torsoH - 1);
      let rw = Math.round(shW + (hipW - shW) * k);
      if (pr.belly && k > 0.5) rw += Math.round(Math.sin((k - 0.5) * Math.PI * 2) * Wd * 0.12 * (variant % 2 ? 1 : 0.3));
      const x0 = cx - rw / 2;
      P(x0, tTop + i, rw, 1, skin);
      P(x0 + rw - Math.max(1, Math.round(rw * 0.28)), tTop + i, Math.max(1, Math.round(rw * 0.28)), 1, dark);
      P(x0, tTop + i, 1, 1, light);
    }
    if (torsoH > 6) {
      P(cx - shW * 0.25, tTop + torsoH * 0.28, shW * 0.18, 1, dark); // грудь
      P(cx + shW * 0.07, tTop + torsoH * 0.28, shW * 0.18, 1, darker);
      P(cx, tTop + torsoH * 0.62, 1, 1, darker); // пупок
    }
    // руки
    const armL = Math.round(torsoH * pr.arm + (pr.arm > 1.3 ? legH * 0.4 : 0));
    const armW = Math.max(1, Math.round(shW * 0.22));
    for (const s of [-1, 1]) {
      const ax = cx + s * (shW / 2) + (s < 0 ? -armW : 0);
      if (frame === 2) { // замах/хватание: руки вперёд-вверх
        P(ax + s * 1, tTop - Math.round(armL * 0.35), armW, Math.round(armL * 0.6), s < 0 ? skin : dark);
        P(ax + s * 1 - 1, tTop - Math.round(armL * 0.35) - 1, armW + 2, Math.max(1, armW), light);
      } else {
        const sw = frame === 1 ? s : -s;
        P(ax + sw * 0.5, tTop + 1, armW, armL, s < 0 ? skin : dark);
        P(ax + sw * 0.5 - (s < 0 ? 1 : 0), tTop + armL, armW + 1, Math.max(1, Math.round(armW * 0.9)), darker); // кисти
      }
    }
    // голова
    const hx = cx - headW / 2 + (pr.crouch ? -1 : 0), hy = top + crouch;
    P(hx + 1, hy, headW - 2, headH, skin);
    P(hx, hy + 1, headW, headH - 2, skin);
    P(hx + headW - Math.max(1, headW * 0.25), hy + 1, Math.max(1, headW * 0.25), headH - 2, dark);
    // уши
    P(hx - 1, hy + headH * 0.4, 1, Math.max(1, headH * 0.2), dark);
    P(hx + headW, hy + headH * 0.4, 1, Math.max(1, headH * 0.2), darker);
    // волосы
    const hairH = Math.max(1, Math.round(headH * (variant % 3 === 0 ? 0.35 : 0.22)));
    P(hx, hy, headW, hairH, hair);
    if (variant % 3 === 1 && headH > 4) { P(hx - 1, hy + 1, 1, headH * 0.6, hair); P(hx + headW, hy + 1, 1, headH * 0.6, hair); }
    // лицо
    const eyeY = hy + Math.round(headH * 0.45);
    const eyeW = headW > 8 ? 2 : 1;
    P(cx - headW * 0.22 - eyeW / 2, eyeY, eyeW, 1, '#1a1210');
    P(cx + headW * 0.22 - eyeW / 2, eyeY, eyeW, 1, '#1a1210');
    if (headH > 6) { P(cx - headW * 0.22 - eyeW / 2, eyeY - 1, eyeW, 1, darker); P(cx + headW * 0.22 - eyeW / 2, eyeY - 1, eyeW, 1, darker); }
    const mY = hy + Math.round(headH * 0.75);
    if (pr.grin) {
      const mw = Math.max(2, Math.round(headW * 0.7));
      P(cx - mw / 2, mY, mw, 1, '#3a1a16');
      if (headH > 5) for (let x = 0; x < mw; x += 2) P(cx - mw / 2 + x, mY - 1, 1, 1, '#efe6d0');
    } else {
      P(cx - headW * 0.15, mY, Math.max(1, headW * 0.3), 1, darker);
    }
    // контур для читаемости на траве
    const id = c.getImageData(0, 0, cw, ch), d = id.data;
    const out = new Uint8ClampedArray(d);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      if (d[i + 3]) continue;
      const nb = (xx, yy) => xx >= 0 && yy >= 0 && xx < cw && yy < ch && d[(yy * cw + xx) * 4 + 3];
      if (nb(x - 1, y) || nb(x + 1, y) || nb(x, y - 1) || nb(x, y + 1)) { out[i] = 40; out[i + 1] = 24; out[i + 2] = 20; out[i + 3] = 200; }
    }
    c.putImageData(new ImageData(out, cw, ch), 0, 0);
    return cv;
  }

  const cache = {};
  A.titanSprite = function (type, variant) {
    const key = type + ':' + variant;
    if (!cache[key]) cache[key] = [make(type, variant, 0), make(type, variant, 1), make(type, variant, 2)];
    return cache[key];
  };

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
