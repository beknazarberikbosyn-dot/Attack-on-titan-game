// Спрайты, нарисованные автором игры (assets/titans/). Подменяют процедурных титанов.
// Из одного кадра собираются три: два шага ходьбы и замах. Эффекты (пар, вспышки, смерть)
// накладываются поверх в render.js, как и для обычных спрайтов.
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const LIST = window.AOT_TITAN_SPRITES || {};
  const FRAMES = ['walk1', 'walk2', 'attack'];
  A.customTitans = {};
  const onReady = [];
  A.onCustomTitan = (fn) => onReady.push(fn);

  const load = (src) => new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });

  A.loadCustomTitans = function () {
    for (const type of Object.keys(LIST)) {
      const cfg = LIST[type];
      Promise.all([load('assets/titans/' + cfg.base), ...FRAMES.map((f) => (cfg[f] ? load('assets/titans/' + cfg[f]) : null))]).then(([base, ...frames]) => {
        if (!base) { console.warn('Спрайт не найден: assets/titans/' + cfg.base); return; }
        A.customTitans[type] = { base, frames, legsFrom: cfg.legsFrom || 0.5, cache: {} };
        onReady.forEach((fn) => fn(type));
      });
    }
  };

  // масштабирование картинки под рост титана (в пикселях спрайта) с чёткими краями
  function scaled(img, th) {
    const k = th / img.height, tw = Math.max(1, Math.round(img.width * k));
    const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = k < 1; c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, tw, th);
    try { // убрать полупрозрачную кайму от сглаживания
      const id = c.getImageData(0, 0, tw, th), d = id.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
      c.putImageData(id, 0, 0);
    } catch (e) { /* локальный file:// — оставляем как есть */ }
    return cv;
  }

  // тёмный контур в 1 пиксель, как у остальных титанов — чтобы не терялся на траве
  function outline(cv) {
    const c = cv.getContext('2d');
    try {
      const w = cv.width, h = cv.height, id = c.getImageData(0, 0, w, h), d = id.data, out = new Uint8ClampedArray(d);
      const a = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3]) continue;
        if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) { out[i] = 30; out[i + 1] = 12; out[i + 2] = 10; out[i + 3] = 230; }
      }
      c.putImageData(new ImageData(out, w, h), 0, 0);
    } catch (e) { /* file:// */ }
  }

  function buildFrame(type, H, f) {
    const ct = A.customTitans[type], S = A.SPRITE_SCALE || 2;
    const th = Math.round(H * S);
    const own = ct.frames[f];
    const src = scaled(own || ct.base, th);
    const tw = src.width, pad = Math.ceil(th * 0.05) + 2;
    const cv = document.createElement('canvas'); cv.width = tw + pad * 2; cv.height = th + pad;
    const c = cv.getContext('2d');
    if (own) c.drawImage(src, pad, pad);
    else {
      // автоанимация: ноги шагают по очереди, корпус покачивается; на замахе корпус подаётся вверх и вширь
      const legY = Math.round(th * ct.legsFrom), half = Math.round(tw / 2);
      const lift = Math.max(1, Math.round(th * 0.014)), sway = Math.max(1, Math.round(th * 0.006));
      const legL = f === 0 ? lift : 0, legR = f === 1 ? lift : 0;
      c.drawImage(src, 0, legY, half, th - legY, pad, pad + legY - legL, half, th - legY);
      c.drawImage(src, half, legY, tw - half, th - legY, pad + half, pad + legY - legR, tw - half, th - legY);
      if (f === 2) {
        const k = 1.05, up = lift * 2;
        c.drawImage(src, 0, 0, tw, legY + 2, pad - tw * (k - 1) / 2, pad - up, tw * k, legY + 2 + up);
      } else {
        const dx = f === 0 ? -sway : sway;
        c.drawImage(src, 0, 0, tw, legY + 2, pad + dx, pad - Math.round(lift / 2), tw, legY + 2);
      }
    }
    outline(cv);
    cv.s = S; cv.custom = true;
    return cv;
  }

  A.customTitanSprite = function (type, H) {
    const ct = A.customTitans[type];
    if (!ct) return null;
    if (!ct.cache[H]) ct.cache[H] = [0, 1, 2].map((f) => buildFrame(type, H, f));
    return ct.cache[H];
  };
})(window.AOT);
