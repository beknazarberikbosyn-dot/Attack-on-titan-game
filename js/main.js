// Точка входа: генерация мира, игровой цикл
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const W = A.WORLD, G = A.G;

  function resize() {
    const cv = document.getElementById('game');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    A.view.cw = window.innerWidth; A.view.ch = window.innerHeight; A.view.dpr = dpr;
    cv.width = Math.round(A.view.cw * dpr); cv.height = Math.round(A.view.ch * dpr);
    A.clampCam();
  }

  function boot() {
    A.generateWorld();
    A.newGame();
    G.paused = true;
    A.ui.init();
    G.log.forEach(A.onLog);
    resize();
    window.addEventListener('resize', resize);
    A.cam.z = 1.5;
    A.centerOn(A.DISTRICTS[0].gx, A.DISTRICTS[0].gy + 60);
    document.getElementById('loading').classList.add('hidden');

    const ctx = document.getElementById('game').getContext('2d');
    const mctx = document.getElementById('minimap').getContext('2d');
    const STEP = 1 / 60;
    let last = performance.now(), acc = 0, hudT = 0, vis = 0;

    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      vis += dt;
      A.ui.panKeys(dt);
      if (A.started && !G.paused && !G.over) {
        acc += dt * (G.speed || 1);
        let n = 0;
        while (acc >= STEP && n < 12) { A.step(STEP); acc -= STEP; n++; }
        if (n >= 12) acc = 0;
      }
      A.render(ctx, vis);
      A.renderMini(mctx, 300, 285);
      hudT -= dt;
      if (hudT <= 0) { hudT = 0.12; A.ui.tick(); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('load', () => setTimeout(boot, 30));
})(window.AOT);
