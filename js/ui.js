// Интерфейс: казарма с карточками, HUD, журнал, панель выбранного, управление
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const W = A.WORLD, G = A.G;
  const $ = (s) => document.querySelector(s);
  const UI = (A.ui = { deployCard: null, selected: null, hover: null, relocating: null });

  // ---------- Сообщения ----------
  let toastT = 0;
  UI.toast = function (msg) {
    const el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1800);
  };

  // ---------- Карточки ----------
  const cardEls = {};
  function initials(name) { return name.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join(''); }

  function buildCards() {
    const box = $('#cards');
    box.innerHTML = '';
    for (const c of A.CARDS) {
      const el = document.createElement('div');
      el.className = 'card';
      el.style.setProperty('--tier', A.TIER_COLORS[c.tier]);
      el.innerHTML = `
        <div class="card-art">
          <div class="card-fallback"><canvas width="44" height="40"></canvas><span>${initials(c.name)}</span></div>
          <canvas class="portrait" width="48" height="40" hidden></canvas>
        </div>
        <div class="card-cost">${c.cost}</div>
        <div class="card-tier">${A.TIER_NAMES[c.tier]}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-role">${c.role}</div>
        <div class="card-hand"></div>
        <button class="px-btn tiny card-plus" title="Купить в резерв">+</button>`;
      const icon = c.cannon || c.ability === 'marshal' ? 'cannon' : c.tier >= 3 ? 'star' : 'blades';
      A.drawIcon(el.querySelector('canvas'), icon, c.tier >= 3 ? '#ffd45a' : '#dfe6ee', c.color);
      // перетащи картинку на карточку — она станет пиксельным портретом
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop'));
      el.addEventListener('drop', (e) => {
        e.preventDefault(); el.classList.remove('drop');
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        A.uploadPortrait(c.id, f, (ok, why) => UI.toast(ok ? `Портрет «${c.name}» готов` : why));
      });

      el.addEventListener('click', () => onCardClick(c.id));
      el.querySelector('.card-plus').addEventListener('click', (e) => {
        e.stopPropagation();
        const r = A.buy(c.id);
        if (!r.ok) UI.toast(r.reason);
        refreshCards();
      });
      el.addEventListener('mouseenter', (e) => showCardTip(c, el));
      el.addEventListener('mouseleave', hideTip);
      box.appendChild(el);
      cardEls[c.id] = el;
    }
  }

  function onCardClick(id) {
    const card = A.CARD[id];
    if (UI.deployCard === id) { UI.deployCard = null; refreshCards(); return; }
    if (G.hand[id] > 0) { UI.deployCard = id; UI.relocating = null; select(null); refreshCards(); return; }
    if (card.kind === 'hero' && A.onField(id)) {
      const u = G.units.find((x) => A.unitAlive(x) && x.card.id === id);
      if (u) { select(u); A.centerOn(u.x, u.y); }
      return;
    }
    const r = A.buy(id);
    if (!r.ok) { UI.toast(r.reason); showPreview(id, true); return; }
    UI.deployCard = id; UI.relocating = null; select(null);
    refreshCards();
  }

  // ---------- Большой портрет выбранной карточки ----------
  let previewId = null, previewPinned = false;
  function showPreview(id, pin) { previewId = id; previewPinned = !!pin; renderPreview(); }
  function renderPreview() {
    const box = $('#cardPreview');
    const id = UI.deployCard || (previewPinned ? previewId : null);
    if (!id || UI.selected) { box.hidden = true; return; }
    const c = A.CARD[id];
    if (box.dataset.id !== id) {
      box.dataset.id = id;
      box.style.setProperty('--tier', A.TIER_COLORS[c.tier]);
      box.innerHTML = `<button class="px-btn tiny close" data-pv="close">×</button>
        <div class="pv-art"><canvas width="192" height="160"></canvas><div class="pv-empty">Нет портрета.<br>Перетащи сюда картинку<br>или нажми «Загрузить»</div></div>
        <h3>${c.name}</h3><div class="role">Уровень ${A.TIER_NAMES[c.tier]} · ${c.role}</div>
        <div class="pv-state"></div>
        <div class="desc">${c.desc}</div>
        <div class="btns">
          <label class="px-btn small">Загрузить портрет<input type="file" accept="image/*" hidden></label>
          <button class="px-btn small ghost" data-pv="clear">Убрать</button>
        </div>
        <div class="pv-hint">Любая картинка станет пиксельной. Чтобы портрет видели все игроки — положи файл <b>assets/cards/${c.id}.png</b> в репозиторий.</div>`;
      box.querySelector('[data-pv="close"]').onclick = () => { UI.deployCard = null; previewPinned = false; refreshCards(); };
      box.querySelector('[data-pv="clear"]').onclick = () => A.clearPortrait(id);
      box.querySelector('input').onchange = (e) => A.uploadPortrait(id, e.target.files[0], (ok, why) => UI.toast(ok ? 'Портрет готов' : why));
      const art = box.querySelector('.pv-art');
      art.ondragover = (e) => { e.preventDefault(); art.classList.add('drop'); };
      art.ondragleave = () => art.classList.remove('drop');
      art.ondrop = (e) => { e.preventDefault(); art.classList.remove('drop'); A.uploadPortrait(id, e.dataTransfer.files[0], (ok, why) => UI.toast(ok ? 'Портрет готов' : why)); };
    }
    const has = A.drawPortrait(box.querySelector('canvas'), id);
    box.querySelector('.pv-empty').hidden = has;
    box.querySelector('[data-pv="clear"]').hidden = !(A.portraits[id] && A.portraits[id].source === 'upload');
    const st = box.querySelector('.pv-state');
    const txt = G.hand[id] > 0 ? `В резерве: ${G.hand[id]} — кликни по карте, чтобы высадить` : A.canBuy(id).ok ? `Цена: ${A.cardCost(id)} баллов` : `Цена: ${A.cardCost(id)} баллов · ${A.canBuy(id).reason}`;
    if (st.textContent !== txt) st.textContent = txt;
    box.hidden = false;
  }
  A.onPortrait((id) => {
    const el = cardEls[id];
    if (el) {
      const cv = el.querySelector('canvas.portrait');
      const has = A.drawPortrait(cv, id);
      cv.hidden = !has; el.querySelector('.card-fallback').hidden = has;
    }
    const pb = $('#cardPreview'); if (pb) pb.dataset.id = '';
    renderPreview();
    if (UI.selected && UI.selected.card && UI.selected.card.id === id) select(UI.selected);
  });

  function refreshCards() {
    for (const c of A.CARDS) {
      const el = cardEls[c.id];
      const h = G.hand[c.id];
      const can = A.canBuy(c.id).ok;
      el.classList.toggle('poor', !can && h === 0);
      el.classList.toggle('selected', UI.deployCard === c.id);
      el.classList.toggle('onfield', c.kind === 'hero' && A.onField(c.id));
      const he = el.querySelector('.card-hand');
      const txt = h > 0 ? '×' + h : (c.id === 'eren' && G.erenRest ? 'отдых' : '');
      if (he.textContent !== txt) he.textContent = txt;
      el.querySelector('.card-plus').disabled = !can;
      const ce = el.querySelector('.card-cost'), cost = String(A.cardCost(c.id));
      if (ce.textContent !== cost) { ce.textContent = cost; ce.classList.toggle('pricey', A.cardCost(c.id) > c.cost); }
    }
    $('#game').classList.toggle('deploying', !!UI.deployCard || !!UI.relocating);
    renderPreview();
  }
  UI.refreshCards = refreshCards;

  // ---------- Подсказки ----------
  const tip = () => $('#tooltip');
  function showCardTip(c, el) {
    const t = tip();
    const strength = c.kind === 'squad' ? `${c.members} бойцов` : c.ability === 'shifter' ? `титан: ${c.titanHp} ОЗ, ${c.stamina} с` : `${c.hp} ран до гибели`;
    t.innerHTML = `<h4>${c.name}</h4><div style="color:${A.TIER_COLORS[c.tier]}">Уровень ${A.TIER_NAMES[c.tier]} · ${c.role}</div>
      <div style="margin-top:6px">${c.desc}</div>
      <div class="stats">
        <span>Цена</span><b>${A.cardCost(c.id)} баллов${A.cardCost(c.id) > c.cost ? ' (наценка из-за беспорядков)' : ''}</b>
        <span>Состав</span><b>${strength}</b>
        ${c.dmg ? `<span>Урон</span><b>${c.dmg}${c.kind === 'squad' ? ' × боец' : ''}</b>` : ''}
        ${c.eva ? `<span>Уклонение</span><b>${Math.round(c.eva * 100)}%</b>` : ''}
        ${c.cannon ? `<span>Пушка</span><b>${c.cannon.dmg} урона, ${c.cannon.range} м</b>` : ''}
        ${c.range ? `<span>Дальность</span><b>${c.range}</b>` : ''}
        ${c.kind === 'hero' ? '<span>Уникальный</span><b>один на поле</b>' : ''}
      </div>`;
    t.hidden = false;
    const r = el.getBoundingClientRect();
    t.style.left = Math.min(window.innerWidth - t.offsetWidth - 8, Math.max(8, r.left)) + 'px';
    t.style.top = (r.top - t.offsetHeight - 8) + 'px';
  }
  function hideTip() { tip().hidden = true; }

  // ---------- Журнал ----------
  let logBox;
  A.onLog = function (e) {
    if (!logBox) return;
    const atBottom = logBox.scrollHeight - logBox.scrollTop - logBox.clientHeight < 40;
    const el = document.createElement('div');
    el.className = 'entry ' + e.kind;
    el.innerHTML = `<span class="tm">${e.wave ? 'В' + e.wave + ' · ' : ''}${A.fmtTime(e.t)}</span><span class="who">${e.who}:</span>`;
    el.appendChild(document.createTextNode(e.text));
    logBox.appendChild(el);
    while (logBox.children.length > 90) logBox.removeChild(logBox.firstChild);
    if (atBottom) logBox.scrollTop = logBox.scrollHeight;
  };

  // ---------- Панель выбранного ----------
  const STATE_RU = {
    deploy: 'Выдвигается', idle: 'На позиции', engage: 'В бою', resupply: 'Летит на склад', refill: 'Дозаправка',
    return: 'Возвращается', exhausted: 'Истощён', transform: 'Превращение', safe: 'За стеной',
  };
  function select(e) {
    UI.selected = e; UI.relocating = null;
    const p = $('#panel');
    if (!e) { p.hidden = true; return; }
    p.hidden = false;
    if (e.kind === 'titan') {
      p.innerHTML = `<button class="px-btn tiny close" data-a="close">×</button>
        <h3>${e.def.name}</h3><div class="role">${e.def.short} · ${e.def.pts} баллов за убийство</div>
        <div class="row"><span>Здоровье</span><b id="pHp"></b></div>
        <div class="row"><span>Броня</span><b id="pArm"></b></div>
        <div class="row"><span>Состояние</span><b id="pSt"></b></div>
        <div class="desc">${e.def.desc}</div>`;
    } else {
      const c = e.card;
      p.innerHTML = `<button class="px-btn tiny close" data-a="close">×</button>
        <div class="p-head"><canvas class="p-portrait" width="96" height="80"></canvas>
        <div><h3>${c.name}</h3><div class="role">${c.role} · уровень ${A.TIER_NAMES[c.tier]}</div></div></div>
        <div class="row"><span>Состояние</span><b id="pSt"></b></div>
        <div class="row"><span>${c.kind === 'squad' ? 'Бойцов' : c.ability === 'shifter' ? 'Титан' : 'Здоровье'}</span><b id="pHp"></b></div>
        <div class="row" id="pGasRow"><span>Газ УПМ</span><b id="pGas"></b></div>
        <div class="meter" id="pGasM"><i></i></div>
        <div class="row"><span>Местность</span><b id="pTer"></b></div>
        <div class="row"><span>Убито титанов</span><b id="pKills"></b></div>
        <div class="thought" id="pTh"></div>
        <div class="btns">
          ${c.kind === 'squad' ? '<button class="px-btn small" data-a="reinf" id="pReinf">Пополнить</button>' : ''}
          ${!c.wallOnly ? '<button class="px-btn small ghost" data-a="move">Переместить</button>' : ''}
          ${!c.wallOnly && c.ability !== 'shifter' ? '<button class="px-btn small ghost" data-a="wall">К стене</button>' : ''}
          <button class="px-btn small ghost" data-a="center">Показать</button>
        </div>
        <div class="desc">${c.desc}</div>`;
    }
    p.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => panelAction(b.dataset.a)));
    const pc = p.querySelector('.p-portrait');
    if (pc && !A.drawPortrait(pc, e.card.id)) pc.remove();
    renderPreview();
    updatePanel();
  }
  UI.select = select;

  function panelAction(a) {
    const e = UI.selected;
    if (!e) return;
    if (a === 'close') return select(null);
    if (a === 'center') return A.centerOn(e.x, e.y);
    if (a === 'reinf') { if (!A.reinforce(e)) UI.toast('Не хватает баллов или отряд полный'); return; }
    if (a === 'move') { UI.relocating = e; UI.deployCard = null; refreshCards(); UI.toast('Кликни по карте — новая позиция'); return; }
    if (a === 'wall') {
      const wp = A.wallPoint(e.x, e.y, A.WALL_T.rose / 2 + 50);
      const r = A.relocate(e, wp.x, wp.y);
      if (!r.ok) UI.toast(r.reason);
    }
  }

  function updatePanel() {
    const e = UI.selected;
    if (!e) return;
    if ((e.kind === 'titan' && e.dead) || (e.kind === 'unit' && (e.dead || e.state === 'safe'))) { select(null); return; }
    const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
    if (e.kind === 'titan') {
      set('pHp', `${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}`);
      set('pArm', e.armor > 0 ? `гасит ${Math.round(e.armor * 100)}% урона` : 'нет');
      const st = [];
      if (e.steamOn) st.push('окутан паром'); else if (e.def.steam) st.push('пар иссяк — уязвим');
      if (e.hardenT > 0) st.push('отвердение'); if (e.rootT > 0) st.push('скован тросами'); if (e.blindT > 0) st.push('ослеплён');
      if (e.markT > 0) st.push('слабые места помечены'); if (e.atWall) st.push('ломает стену'); if (e.retreating) st.push('отступает');
      if (e.disarmT > 0) st.push('без рук'); if (e.charging) st.push('таран!');
      if (e.crystalT > 0) st.push(`в кристалле (прочность ${Math.ceil(e.crystalHp)})`); if (e.climbed) st.push('на стене');
      set('pSt', st.join(', ') || 'идёт к стене');
      return;
    }
    const c = e.card;
    let st = STATE_RU[e.state] || e.state;
    if (e.order) st = { spear: 'Приказ: громовое копьё', flank: 'Приказ: обход с фланга', charge: 'Приказ: кавалерийская атака', focus: 'Приказ: атаковать цель', fallback: 'Приказ: отход', seal: 'Приказ: заткнуть пролом' }[e.order.kind] || st;
    if (c.ability === 'shifter') st = e.form === 'titan' ? 'В форме титана' : st;
    set('pSt', st);
    if (c.kind === 'squad') set('pHp', `${e.members} / ${e.maxMembers}`);
    else if (c.ability === 'shifter') set('pHp', e.form === 'titan' ? `${Math.ceil(e.titanHp)} ОЗ · сил ${Math.ceil(e.stamina)} с` : 'человек');
    else set('pHp', `${e.hp} / ${e.maxHp}`);
    const gasless = c.cannon && e.onWall || c.wallOnly || c.ability === 'shifter';
    document.getElementById('pGasRow').style.display = gasless ? 'none' : '';
    document.getElementById('pGasM').style.display = gasless ? 'none' : '';
    set('pGas', Math.round(e.gas) + '%');
    const gm = document.querySelector('#pGasM i'); if (gm) gm.style.width = e.gas + '%';
    const ti = A.TERRAIN_INFO[A.terrainAt(e.x, e.y)];
    set('pTer', `${ti.name} (${Math.round(ti.anchor * 100)}%)`);
    set('pKills', String(e.kills || 0));
    set('pTh', '«' + (e.thought || '…') + '»');
    const rb = document.getElementById('pReinf');
    if (rb) { const cost = A.reinforceCost(e); rb.textContent = cost ? `Пополнить (${cost} б.)` : 'Отряд полный'; rb.disabled = !cost || G.points < cost; }
  }

  // ---------- HUD ----------
  let speedIdx = 0;
  const SPEEDS = [1, 2, 3];
  function updateHud() {
    const set = (id, v) => { const el = document.getElementById(id); if (el.textContent !== String(v)) el.textContent = v; };
    set('hudWave', G.wave);
    if (G.phase === 'prep') { set('hudPhaseLbl', 'До атаки'); set('hudPhase', A.fmtTime(Math.max(0, G.prepT))); $('#btnStart').hidden = false; }
    else { set('hudPhaseLbl', 'Титанов'); set('hudPhase', G.titans.filter((t) => !t.dead).length + G.queue.length); $('#btnStart').hidden = true; }
    set('hudPoints', G.points);
    set('hudWall', Math.ceil(G.wallHp));
    const f = $('#hudWallFill');
    f.style.width = (G.wallHp / G.wallMax * 100) + '%';
    f.classList.toggle('low', G.wallHp < G.wallMax * 0.35);
    set('hudSpears', G.spears);
    set('hudField', `${A.fieldCount()}/${A.fieldCap()}`);
    const L = A.UNREST_LEVELS[G.unrestLvl];
    set('hudUnrestLvl', `${L.name} ${Math.round(G.unrest)}%`);
    const uf = $('#hudUnrestFill'); uf.style.width = G.unrest + '%'; uf.style.background = L.col;
    $('#hudUnrestLvl').style.color = L.col;
    const ub = $('#unrestBox');
    ub.classList.toggle('alarm', G.unrestLvl >= 3);
    const fineNote = G.unrestLvl >= 2 ? ` Следующий штраф через ${Math.ceil(Math.max(0, G.fineT))} с.` : '';
    ub.title = `Недовольство народа: ${Math.round(G.unrest)}%. ${L.effect}${fineNote}\nРастёт от гибели солдат, частых потерь и ударов по стене. Падает, когда волны отбиты без потерь, когда убиты шифтеры и в спокойное время. Пиксис на поле смягчает гнев на 25%.`;
    set('btnPause', G.paused ? '▶' : '❚❚');
    set('btnSpeed', '×' + SPEEDS[speedIdx]);
  }

  UI.tick = function () {
    updateHud();
    refreshCards();
    updatePanel();
  };

  // ---------- Ввод ----------
  function initInput() {
    const cv = $('#game');
    let down = null, dragging = false;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      down = { x: e.clientX, y: e.clientY, cx: A.cam.x, cy: A.cam.y, btn: e.button };
      dragging = e.button === 1 || e.button === 2;
      if (e.button === 2 && (UI.deployCard || UI.relocating)) { UI.deployCard = null; UI.relocating = null; refreshCards(); }
    });
    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      A.mouse.x = e.clientX - r.left; A.mouse.y = e.clientY - r.top; A.mouse.inside = true;
      const w = A.screenToWorld(A.mouse.x, A.mouse.y);
      A.mouse.wx = w.x; A.mouse.wy = w.y;
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!dragging && Math.hypot(dx, dy) > 6) dragging = true;
        if (dragging) { A.cam.x = down.cx - dx / A.cam.z; A.cam.y = down.cy - dy / A.cam.z; A.clampCam(); cv.classList.add('dragging'); }
      } else {
        UI.hover = A.pickAt(w.x, w.y);
      }
    });
    cv.addEventListener('pointerleave', () => { A.mouse.inside = false; });
    cv.addEventListener('pointerup', (e) => {
      cv.classList.remove('dragging');
      const wasDrag = dragging; const d = down; down = null; dragging = false;
      if (wasDrag || !d || d.btn !== 0) return;
      const w = A.screenToWorld(A.mouse.x, A.mouse.y);
      if (UI.relocating) {
        const r = A.relocate(UI.relocating, w.x, w.y);
        if (!r.ok) UI.toast(r.reason);
        UI.relocating = null; refreshCards(); return;
      }
      if (UI.deployCard) {
        const r = A.deploy(UI.deployCard, w.x, w.y);
        if (!r.ok) { UI.toast(r.reason); return; }
        if (G.hand[UI.deployCard] <= 0 && !e.shiftKey) UI.deployCard = null;
        refreshCards(); return;
      }
      select(A.pickAt(w.x, w.y));
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      A.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    const keys = {};
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); G.paused = !G.paused; }
      if (e.code === 'KeyF') cycleSpeed();
      if (e.code === 'Escape') { UI.deployCard = null; UI.relocating = null; select(null); refreshCards(); }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') A.zoomAt(A.view.cw / 2, A.view.ch / 2, 1);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') A.zoomAt(A.view.cw / 2, A.view.ch / 2, -1);
      if (e.code === 'Enter' && G.phase === 'prep') A.startWave();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    UI.panKeys = function (dt) {
      const s = 700 * dt / A.cam.z;
      if (keys.KeyA || keys.ArrowLeft) A.cam.x -= s;
      if (keys.KeyD || keys.ArrowRight) A.cam.x += s;
      if (keys.KeyW || keys.ArrowUp) A.cam.y -= s;
      if (keys.KeyS || keys.ArrowDown) A.cam.y += s;
      A.clampCam();
    };

    // мини-карта
    const mm = $('#minimap');
    let mmDown = false;
    const mmGo = (e) => {
      const r = mm.getBoundingClientRect();
      A.centerOn((e.clientX - r.left) / r.width * W.W, (e.clientY - r.top) / r.height * W.H);
    };
    mm.addEventListener('pointerdown', (e) => { mmDown = true; mm.setPointerCapture(e.pointerId); mmGo(e); });
    mm.addEventListener('pointermove', (e) => { if (mmDown) mmGo(e); });
    mm.addEventListener('pointerup', () => { mmDown = false; });
    $('#zoomIn').onclick = () => A.zoomAt(A.view.cw / 2, A.view.ch / 2, 1);
    $('#zoomOut').onclick = () => A.zoomAt(A.view.cw / 2, A.view.ch / 2, -1);

    document.querySelectorAll('[data-army]').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.army, moved = A.moveArmyTo([i]);
        const n = Object.values(moved).reduce((a, c) => a + c, 0);
        UI.toast(n ? `${n} отрядов идут к району ${A.DISTRICTS[i].name}` : `Все уже у района ${A.DISTRICTS[i].name}`);
        A.centerOn(A.DISTRICTS[i].gx, A.DISTRICTS[i].gy);
      };
    });
    $('#btnStart').onclick = () => A.startWave();
    $('#btnPause').onclick = () => { G.paused = !G.paused; };
    $('#btnSpeed').onclick = cycleSpeed;
    $('#btnLog').onclick = () => { $('#log').classList.toggle('collapsed'); $('#btnLog').textContent = $('#log').classList.contains('collapsed') ? '+' : '–'; };
    $('#btnHelp').onclick = () => { G.paused = true; $('#overlay').classList.remove('hidden'); $('#startModal').hidden = false; $('#overModal').hidden = true; $('#btnPlay').textContent = 'Продолжить'; };
  }
  function cycleSpeed() { speedIdx = (speedIdx + 1) % SPEEDS.length; G.speed = SPEEDS[speedIdx]; }

  // ---------- Экраны ----------
  function showOver() {
    const killed = Object.entries(G.killsBy).sort((a, b) => A.TITANS[b[0]].pts - A.TITANS[a[0]].pts)
      .map(([k, n]) => `${A.TITANS[k].name}: ${n}`).join(' · ');
    let best = 0;
    try { best = +localStorage.getItem('aot_best_wave') || 0; } catch (e) { /* нет хранилища */ }
    $('#overStats').innerHTML = `Продержались до волны <b>${G.wave}</b> (рекорд: ${best})<br>
      Убито титанов: <b>${G.kills}</b><br><small>${killed || '—'}</small><br>
      Потеряно отрядов и героев: <b>${G.lost}</b>`;
    $('#overlay').classList.remove('hidden');
    $('#startModal').hidden = true; $('#overModal').hidden = false;
  }
  A.onGameOver = () => setTimeout(showOver, 1200);

  // новая волна с другого направления — показать, куда идут титаны
  A.onWaveStart = function (dirs) {
    const D = A.DISTRICTS[dirs[0]];
    const p = A.screenToWorld(A.view.cw / 2, A.view.ch / 2);
    if (Math.hypot(p.x - D.gx, p.y - D.gy) > 500) { A.cam.z = Math.min(A.cam.z, 1); A.centerOn(D.gx + D.nx * 160, D.gy + D.ny * 160); }
    UI.toast(`Титаны идут на ${dirs.map((i) => A.DISTRICTS[i].name).join(' и ')}!`);
  };

  UI.init = function () {
    logBox = $('#logList');
    buildCards();
    A.loadPortraits();
    initInput();
    try { const b = +localStorage.getItem('aot_best_wave') || 0; if (b) $('#bestWave').textContent = `Рекорд: волна ${b}`; } catch (e) { /* нет хранилища */ }
    $('#btnPlay').onclick = () => {
      $('#overlay').classList.add('hidden');
      G.paused = false; A.started = true;
    };
    $('#btnRestart').onclick = () => {
      A.newGame(); logBox.innerHTML = ''; G.log.forEach(A.onLog);
      UI.deployCard = null; select(null); speedIdx = 0;
      A.cam.z = 1.5; A.centerOn(A.DISTRICTS[0].gx, A.DISTRICTS[0].gy + 60);
      $('#overlay').classList.add('hidden');
      A.started = true;
    };
  };
})(window.AOT);
