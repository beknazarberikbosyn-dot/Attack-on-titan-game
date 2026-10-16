// Общие утилиты: случайные числа, математика, шум
window.AOT = window.AOT || {};
(function (A) {
  'use strict';

  // Детерминированный генератор (для карты)
  A.rng = function (seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Быстрый хэш пикселя -> [0,1)
  A.hash = function (x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };

  // Value-noise с билинейной интерполяцией
  A.makeNoise = function (seed, cell) {
    return function (x, y) {
      const gx = x / cell, gy = y / cell;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = A.hash(x0, y0, seed), b = A.hash(x0 + 1, y0, seed);
      const c = A.hash(x0, y0 + 1, seed), d = A.hash(x0 + 1, y0 + 1, seed);
      return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    };
  };

  A.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  A.lerp = (a, b, t) => a + (b - a) * t;
  A.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  A.distXY = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  A.rand = (a, b) => a + Math.random() * (b - a);
  A.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  A.chance = (p) => Math.random() < p;
  A.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // "#rrggbb" -> [r,g,b]
  A.hex = function (h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const shadeCache = new Map();
  A.shade = function (h, k) {
    k = Math.round(k * 50) / 50;
    const key = h + k;
    let v = shadeCache.get(key);
    if (v) return v;
    const c = A.hex(h).map((x) => A.clamp(Math.round(x * k), 0, 255));
    v = '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
    shadeCache.set(key, v);
    return v;
  };

  A.fmtTime = function (t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  };
})(window.AOT);
