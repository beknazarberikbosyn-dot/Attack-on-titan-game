// Портреты персонажей: любую картинку (из интернета, скриншот, арт) превращаем в пиксель-арт.
// Источники: 1) загрузка прямо в игре (сохраняется в браузере), 2) файлы assets/cards/<id>.png|jpg|webp
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const PW = 48, PH = 40;           // разрешение пиксельного портрета
  const EXT = ['png', 'jpg', 'jpeg', 'webp', 'PNG', 'JPG'];
  A.PORTRAIT_SIZE = { w: PW, h: PH };
  A.portraits = {};                 // id -> { canvas, source: 'upload' | 'file' }
  const listeners = [];
  A.onPortrait = (fn) => listeners.push(fn);
  const emit = (id) => listeners.forEach((f) => f(id));

  // Пикселизация: кадрируем по центру (лицо обычно в верхней трети), уменьшаем, усиливаем цвет и
  // сводим палитру к ограниченному набору оттенков — получается спрайт в духе 16-битных игр.
  A.pixelate = function (img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const ar = PW / PH;
    let sw = iw, sh = iw / ar;
    if (sh > ih) { sh = ih; sw = ih * ar; }
    const sx = (iw - sw) / 2, sy = Math.max(0, Math.min(ih - sh, (ih - sh) * 0.22));
    const mid = document.createElement('canvas'); mid.width = PW * 4; mid.height = PH * 4;
    const m = mid.getContext('2d'); m.imageSmoothingEnabled = true; m.imageSmoothingQuality = 'high';
    m.drawImage(img, sx, sy, sw, sh, 0, 0, mid.width, mid.height);
    const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(mid, 0, 0, PW, PH);
    try {
      const id = c.getImageData(0, 0, PW, PH), d = id.data;
      const L = 7, q = (v) => Math.round(Math.round(A.clamp(v, 0, 255) / 255 * (L - 1)) * 255 / (L - 1));
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        const avg = (r + g + b) / 3;
        r = avg + (r - avg) * 1.25; g = avg + (g - avg) * 1.25; b = avg + (b - avg) * 1.25; // насыщенность
        r = (r - 128) * 1.12 + 128; g = (g - 128) * 1.12 + 128; b = (b - 128) * 1.12 + 128; // контраст
        d[i] = q(r); d[i + 1] = q(g); d[i + 2] = q(b); d[i + 3] = 255;
      }
      c.putImageData(id, 0, 0);
    } catch (e) { /* локальный file:// — палитру не трогаем, уменьшение всё равно даёт пиксель-арт */ }
    return cv;
  };

  function set(id, canvas, source) { A.portraits[id] = { canvas, source }; emit(id); }

  function tryFile(id, k) {
    if (k >= EXT.length) return;
    const img = new Image();
    img.onload = () => set(id, A.pixelate(img), 'file');
    img.onerror = () => tryFile(id, k + 1);
    img.src = `assets/cards/${id}.${EXT[k]}`;
  }

  A.loadPortraits = function () {
    for (const c of A.CARDS) {
      let saved = null;
      try { saved = localStorage.getItem('aot_portrait_' + c.id); } catch (e) { /* нет хранилища */ }
      if (saved) {
        const img = new Image();
        img.onload = () => { const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; cv.getContext('2d').drawImage(img, 0, 0); set(c.id, cv, 'upload'); };
        img.src = saved;
      } else tryFile(c.id, 0);
    }
  };

  // загрузка своей картинки прямо в игре
  A.uploadPortrait = function (id, file, done) {
    if (!file || !/^image\//.test(file.type)) { if (done) done(false, 'Это не картинка'); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cv = A.pixelate(img);
        try { localStorage.setItem('aot_portrait_' + id, cv.toDataURL('image/png')); } catch (e) { /* без сохранения */ }
        set(id, cv, 'upload');
        if (done) done(true);
      };
      img.onerror = () => done && done(false, 'Не удалось прочитать картинку');
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };
  A.clearPortrait = function (id) {
    try { localStorage.removeItem('aot_portrait_' + id); } catch (e) { /* нет хранилища */ }
    delete A.portraits[id];
    emit(id);
    tryFile(id, 0);
  };

  // нарисовать портрет (или значок, если портрета нет) в canvas
  A.drawPortrait = function (canvas, id) {
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const p = A.portraits[id];
    if (p) { c.drawImage(p.canvas, 0, 0, canvas.width, canvas.height); return true; }
    return false;
  };
})(window.AOT);
