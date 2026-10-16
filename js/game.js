// Симуляция боя: состояние, юниты, титаны, снаряды, волны, экономика
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const W = A.WORLD;
  const G = (A.G = {});
  let nextId = 1;

  const SDE = (e) => A.sdRose(e.x, e.y);
  const HALF = () => A.WALL_T.rose / 2;

  // ---------- Журнал, всплывающий текст, частицы ----------
  A.log = function (who, text, kind) {
    const e = { t: G.t || 0, wave: G.wave || 0, who, text, kind: kind || 'info' };
    G.log.push(e);
    if (G.log.length > 160) G.log.shift();
    if (A.onLog) A.onLog(e);
  };
  A.float = function (x, y, text, col, big) {
    G.floaters.push({ x, y, text, col: col || '#fff', life: big ? 2.2 : 1.5, max: big ? 2.2 : 1.5, big: !!big });
  };
  A.puff = function (x, y, z, opts) {
    const o = opts || {};
    const n = o.n || 6;
    for (let i = 0; i < n; i++) {
      const life = (o.life || 1.2) * A.rand(0.7, 1.3);
      G.fx.push({
        x: x + A.rand(-(o.spread || 4), o.spread || 4), y: y + A.rand(-2, 2), z: z + A.rand(0, o.zs || 2),
        vx: A.rand(-1, 1) * (o.spd || 8), vy: A.rand(-0.5, 0.5) * (o.spd || 8), vz: (o.up || 10) * A.rand(0.6, 1.4),
        life, max: life, size: o.size || 2, grow: o.grow || 2, col: Array.isArray(o.col) ? A.pick(o.col) : (o.col || '#e8e8e8'),
        g: o.g || 0, fade: o.fade !== false,
      });
    }
  };
  A.steamBurst = function (x, y, h) {
    const k = Math.max(1, h / 26);
    A.puff(x, y, h * 0.3, { n: Math.round(14 * Math.sqrt(k)), col: ['#f4f4f4', '#dcdcdc', '#c8c8c8'], spd: 10 * k, up: 14 * k, life: 2.2, size: 3 * Math.sqrt(k), grow: 4 * Math.sqrt(k), spread: h * 0.3, zs: h * 0.6 });
  };
  A.explosion = function (x, y, z) {
    A.puff(x, y, z, { n: 14, col: ['#ffd25a', '#ff9a3a', '#ff6a2a', '#fff2b0'], spd: 40, up: 20, life: 0.5, size: 2, grow: 3 });
    A.puff(x, y, z, { n: 10, col: ['#5a5654', '#6e6a66', '#48443f'], spd: 14, up: 12, life: 1.6, size: 3, grow: 5 });
  };
  A.sparks = function (x, y, z, col) {
    A.puff(x, y, z, { n: 5, col: col || ['#ffffff', '#e8f0ff', '#cfe0ff'], spd: 30, up: 10, life: 0.25, size: 1, grow: 0, g: 60 });
  };
  A.dust = function (x, y, s) {
    A.puff(x, y, 0, { n: Math.round(10 * s), col: ['#b8a888', '#a08f70', '#cbbd9e'], spd: 26 * s, up: 8 * s, life: 1.2, size: 2 * s, grow: 4 * s, spread: 10 * s });
  };
  A.flare = function (x, y, col) {
    G.fx.push({ x, y, z: 6, vx: A.rand(-3, 3), vy: 0, vz: 90, life: 1.6, max: 1.6, size: 2, grow: 0, col, flare: true, trail: col, g: 30 });
  };

  // ---------- Новая игра ----------
  A.newGame = function () {
    for (const k in G) delete G[k];
    Object.assign(G, {
      t: 0, wave: 0, phase: 'prep', prepT: 50, points: A.START_POINTS,
      wallHp: W.wallHp, wallMax: W.wallHp, spears: 0,
      titans: [], units: [], projs: [], fx: [], floaters: [], log: [],
      hand: {}, queue: [], waveT: 0, hpMul: 1, spdMul: 1, over: false,
      kills: 0, killsBy: {}, lost: 0, rockHits: [], shake: 0,
      analyzed: {}, sealed: false, erenRest: false, auras: {}, dir: { cd: {} },
      speed: 1, paused: false,
    });
    A.CARDS.forEach((c) => { G.hand[c.id] = 0; });
    G.nextQueue = prepQueue(1);
    A.log('Штаб', 'Стена Мария пала. Разведка: титаны идут из павших земель к району Трост (юг Стены Роза). Купите карточки и расставьте бойцов у Троста — волна начнётся по таймеру или по кнопке «В бой».', 'info');
  };

  // ---------- Экономика ----------
  A.onField = (id) => G.units.some((u) => !u.dead && u.card.id === id && u.state !== 'safe');
  A.ownedCount = (id) => G.hand[id] + (A.onField(id) ? 1 : 0) + (id === 'eren' && G.erenRest ? 1 : 0);
  A.canBuy = function (id) {
    const c = A.CARD[id];
    if (G.points < c.cost) return { ok: false, reason: 'Не хватает баллов' };
    if (c.kind === 'hero' && A.ownedCount(id) > 0) return { ok: false, reason: 'Персонаж уже у вас' };
    return { ok: true };
  };
  A.buy = function (id) {
    const can = A.canBuy(id);
    if (!can.ok) return can;
    const c = A.CARD[id];
    G.points -= c.cost;
    G.hand[id]++;
    A.log('Казарма', `Получена карточка «${c.name}» (−${c.cost} б.)`, 'buy');
    return { ok: true };
  };

  A.fieldCount = () => G.units.filter((u) => !u.dead && u.state !== 'safe').length;
  A.fieldCap = () => 6 + Math.floor(G.wave * 0.6);

  A.canDeploy = function (card, x, y, moving) {
    if (!moving && A.fieldCount() >= A.fieldCap()) return { ok: false, reason: `Лимит бойцов на поле: ${A.fieldCap()}` };
    if (y < 16 || y > W.H - 16 || x < 10 || x > W.W - 10) return { ok: false, reason: 'За краем карты' };
    const sd = A.sdRose(x, y);
    if (sd > A.DEPLOY_OUT) return { ok: false, reason: 'Слишком далеко за Стеной Роза' };
    const ter = A.terrainAt(x, y);
    if (ter === 'sea') return { ok: false, reason: 'Это море' };
    const onWall = Math.abs(sd) <= HALF() + 3;
    if (card.wallOnly && !onWall) return { ok: false, reason: 'Только на Стене Роза' };
    if (card.id === 'eren' && onWall) return { ok: false, reason: 'Превращаться на стене нельзя' };
    if (ter === 'river') return { ok: false, reason: 'В воде не встать' };
    return { ok: true, onWall };
  };

  A.deploy = function (cardId, x, y, quiet) {
    const card = A.CARD[cardId];
    const can = A.canDeploy(card, x, y);
    if (!can.ok || G.hand[cardId] <= 0) return can.ok ? { ok: false, reason: 'Нет карточки в резерве' } : can;
    G.hand[cardId]--;
    const u = spawnUnit(card, x, y, can.onWall);
    if (!quiet) A.log('Казарма', `${card.name} → ${A.TERRAIN_INFO[A.terrainAt(x, y)].name}`, 'deploy');
    return { ok: true, unit: u };
  };

  function nearestSupply(x, y) {
    let b = A.SUPPLY[0], bd = 1e9;
    for (const s of A.SUPPLY) { const d = A.distXY(x, y, s.x, s.y); if (d < bd) { bd = d; b = s; } }
    return b;
  }
  A.nearestSupply = nearestSupply;

  function spawnUnit(card, x, y, onWall) {
    // солдаты спрыгивают со стены на тросах; в тыл идут от складов
    const sdP = A.sdRose(x, y);
    const start = onWall ? { x, y } : sdP > 0 ? A.wallPoint(x, y, 0) : nearestSupply(x, y);
    const u = {
      id: nextId++, kind: 'unit', card, x: start.x, y: start.y, z: 0,
      post: { x, y }, onWall: !!onWall, state: 'deploy', target: null,
      atkT: A.rand(0, 1), abilT: A.rand(0, 2), gas: 100,
      hp: card.hp || 0, maxHp: card.hp || 0,
      members: card.members || 0, maxMembers: card.members || 0,
      order: null, thought: 'Выдвигается на позицию', dead: false, deadT: 0,
      anim: A.rand(0, 10), face: 1, refillT: 0,
    };
    if (card.ability === 'shifter') {
      u.state = 'deploy'; u.form = 'human'; u.titanHp = card.titanHp; u.titanMax = card.titanHp; u.stamina = card.stamina;
      u.thought = 'Бежит к месту превращения';
    }
    if (card.wallOnly) { u.thought = 'Командует с бастиона'; }
    if (card.ability === 'commander' && !G.erwinSupplied) {
      G.erwinSupplied = true;
      const add = 4;
      G.spears += add;
      A.log('Эрвин Смит', `Прибыл с обозом: +${add} громовых копья. «Солдаты, отдайте свои сердца!»`, 'order');
    }
    G.units.push(u);
    return u;
  }
  A.spawnUnitDirect = spawnUnit;

  A.reinforceCost = (u) => (u.card.kind === 'squad' && u.members < u.maxMembers ? Math.ceil(u.card.cost * 0.6 * (u.maxMembers - u.members) / u.maxMembers) : 0);
  A.reinforce = function (u) {
    const cost = A.reinforceCost(u);
    if (!cost || G.points < cost || u.dead) return false;
    G.points -= cost; u.members = u.maxMembers;
    A.float(u.x, u.y - 14, 'Пополнение', '#9fd0ff');
    A.log('Казарма', `${u.card.name}: отряд пополнен до ${u.maxMembers} бойцов (−${cost} б.)`, 'buy');
    return true;
  };
  A.relocate = function (u, x, y) {
    const can = A.canDeploy(u.card, x, y, true);
    if (!can.ok) return can;
    if (u.card.ability === 'shifter' && u.form !== 'titan') return { ok: false, reason: 'Сейчас не может' };
    u.post = { x, y }; u.onWall = can.onWall; u.target = null; u.order = null;
    if (u.state !== 'resupply' && u.state !== 'refill') u.state = 'return';
    u.thought = 'Меняет позицию по приказу';
    return { ok: true };
  };

  // ---------- Свойства юнитов ----------
  A.unitAlive = (u) => !u.dead && u.state !== 'safe';
  function inTown(u) { return SDE(u) < -HALF() - 2; }
  function reachable(u) { return A.unitAlive(u) && !u.onWall && !inTown(u); }
  A.reachable = reachable;

  function effEva(u) {
    const c = u.card;
    if (c.ability === 'shifter') return u.form === 'titan' ? 0.25 : 0.15;
    let e = c.eva * (0.82 + 0.18 * A.anchorAt(u.x, u.y));
    if (G.auras.jean && u.card.id !== 'jean' && A.distXY(u.x, u.y, G.auras.jean.x, G.auras.jean.y) < 180) e += 0.06;
    if (G.auras.armin && A.distXY(u.x, u.y, G.auras.armin.x, G.auras.armin.y) < 220) e += 0.04;
    if (G.auras.erwin && c.faction === 'survey') e += 0.02;
    if (u.order && u.order.kind === 'flank') e = Math.max(e, 0.995);
    return Math.min(0.995, e);
  }
  A.effEva = effEva;

  A.unitStrength = (u) => (u.card.kind === 'squad' ? u.members : u.card.ability === 'shifter' ? (u.form === 'titan' ? 1 : 0) : u.hp);

  function killUnit(u, cause) {
    if (u.dead) return;
    u.dead = true; u.deadT = 0; G.lost++;
    A.log('Потери', `${u.card.name} — ${cause || 'пал(а) в бою'}.`, 'loss');
    A.float(u.x, u.y - 12, u.card.kind === 'squad' ? 'Отряд погиб' : 'Погиб(ла)', '#ff6b5a', true);
  }
  A.killUnit = killUnit;

  // удар по юниту (от титана, камня, пара)
  A.hitUnit = function (u, src, kind) {
    if (!A.unitAlive(u)) return;
    const c = u.card;
    if (c.ability === 'shifter') {
      if (u.form === 'titan') {
        const dmg = kind === 'rock' ? 140 : kind === 'steam' ? 70 : (src && src.def ? src.def.hitDmg : 40);
        u.titanHp -= dmg;
        A.float(u.x, u.y - 34, '-' + Math.round(dmg), '#ffb0a0');
        if (u.titanHp <= 0) erenEmerge(u, 'титан Эрена повержен');
      } else if (u.form === 'human' && u.state !== 'deploy') {
        killUnit(u, 'схвачен(а) титаном в истощении');
      } else if (u.state === 'deploy') {
        killUnit(u, 'схвачен(а) до превращения');
      }
      return;
    }
    if (c.kind === 'squad') {
      u.members--;
      A.float(u.x, u.y - 10, '−1 боец', '#ff8a7a');
      if (u.members <= 0) killUnit(u, kind === 'rock' ? 'накрыт камнями' : kind === 'steam' ? 'обварен паром' : 'перебит титанами');
    } else {
      u.hp--;
      A.float(u.x, u.y - 14, u.hp > 0 ? 'Ранен(а)!' : '', '#ff8a7a');
      if (u.hp <= 0) killUnit(u, kind === 'rock' ? 'погиб(ла) под камнепадом' : kind === 'steam' ? 'погиб(ла) в пару' : 'погиб(ла) в бою');
      else if (u.hp === 1 && c.ability !== 'spin') { u.thought = 'Тяжело ранен(а) — отходит к складу'; u.state = 'resupply'; u.target = null; }
    }
  };

  // ---------- Титаны ----------
  A.spawnTitan = function (type, opts) {
    const def = A.TITANS[type];
    opts = opts || {};
    const t = {
      id: nextId++, kind: 'titan', type, def,
      x: 0, y: 0, district: opts.district != null ? opts.district : 0,
      hp: def.hp * G.hpMul, maxHp: def.hp * G.hpMul, armor: def.armor || 0,
      laneOff: A.rand(-1.1, 1.1),
      atkT: A.rand(0.5, 2), blindT: 0, stunT: 0, markT: 0, rootT: 0, hardenT: 0, hardenCd: 0,
      forced: null, forcedT: 0, enrageT: 0, grabT: 0, disarmT: 0, distractT: 0, hitFlash: 0,
      leapT: A.rand(2, 5), leap: null, throwT: 3, wallHitT: 0, steamOn: false, steamT: 6, steamTick: 0,
      anim: A.rand(0, 10), variant: A.randInt(0, 11), dead: false, deadT: 0, screamed: false, retreating: false,
      spearHits: 0,
    };
    if (opts.near) { t.x = opts.near.x + A.rand(-180, 180); t.y = opts.near.y + A.rand(-180, 180); t.district = opts.near.district || 0; }
    else if (opts.x != null) { t.x = opts.x; t.y = opts.y; }
    else {
      // появляются в павших землях Марии напротив атакуемого района (иногда — через пролом Шиганшины)
      const D = A.DISTRICTS[t.district];
      for (let k = 0; k < 8; k++) {
        const a = D.ang + A.rand(-0.45, 0.45), rr = A.R.maria - A.rand(45, 120);
        t.x = A.C.x + Math.cos(a) * rr; t.y = A.C.y + Math.sin(a) * rr;
        if (t.district === 0 && A.chance(0.3)) { const S = A.MARIA_D[0]; t.x = S.cx + A.rand(-40, 40); t.y = S.cy - A.rand(10, 70); }
        if (!A.inRiver(t.x, t.y)) break;
      }
    }
    clampTitan(t);
    G.titans.push(t);
    if (def.special) {
      A.log('Дозор', `На горизонте: ${def.name}! ${def.desc}`, 'warn');
      if (type === 'colossal') { A.steamBurst(t.x, t.y, 120); G.shake = 1.2; }
    }
    return t;
  };

  // титаны тянутся к выступу района — для этого районы и строили
  function gateTarget(t) {
    const D = A.DISTRICTS[t.district || 0];
    const a = D.ang + t.laneOff, rr = D.r + HALF() + t.def.w * 0.5 + 1;
    return { x: D.cx + Math.cos(a) * rr, y: D.cy + Math.sin(a) * rr };
  }

  A.damageTitan = function (t, dmg, src, opts) {
    if (t.dead) return 0;
    opts = opts || {};
    let d = dmg;
    if (opts.pierce) { /* копьё — броня не помогает */ }
    else if (opts.armorPen) d *= 1 - t.armor * (1 - opts.armorPen);
    else d *= 1 - t.armor;
    if (t.hardenT > 0 && !opts.pierce) d *= 0.08;
    if (t.def.steam && !t.steamOn) d *= 1.5;
    if (t.markT > 0) d *= 1.3;
    if (t.rootT > 0) d *= 1.4;
    if (t.blindT > 0) d *= 1.2;
    if (G.analyzed[t.type]) d *= 1.1;
    t.hp -= d;
    t.hitFlash = 0.12;
    // отвердение у Женской особи
    if (t.def.harden && !opts.pierce && opts.melee && t.hardenCd <= 0 && t.hp < t.maxHp * 0.85 && A.chance(0.33)) {
      t.hardenT = 2.5; t.hardenCd = 8;
      A.float(t.x, t.y - t.def.h - 6, 'Отвердение!', '#bfe6ff');
    }
    if (t.def.scream && !t.screamed && t.hp < t.maxHp * 0.5 && t.hp > 0) {
      t.screamed = true;
      A.log('Дозор', 'Женская особь издала крик — титаны в округе в ярости, с востока бегут новые!', 'warn');
      A.float(t.x, t.y - t.def.h - 10, 'КРИК!', '#ffdf7a', true);
      for (const o of G.titans) if (!o.dead && A.dist(o, t) < 700) o.enrageT = 10;
      for (let i = 0; i < 4; i++) A.spawnTitan('normal', { near: t });
    }
    if (t.hp <= 0) killTitan(t, src, opts.capture);
    return d;
  };

  function killTitan(t, src, captured) {
    t.dead = true; t.deadT = 0; t.captured = !!captured;
    const pts = Math.round(t.def.pts * (captured ? 1.5 : 1));
    G.points += pts; G.kills++;
    G.killsBy[t.type] = (G.killsBy[t.type] || 0) + 1;
    if (!captured) A.steamBurst(t.x, t.y, t.def.h);
    A.float(t.x, t.y - t.def.h - 4, '+' + pts, '#ffd45a', t.def.special);
    const who = src && src.card ? src.card.name : src === 'cannon' ? 'Пушки гарнизона' : src === 'spear' ? 'Громовое копьё' : 'Солдаты';
    if (t.def.special) A.log(who, `${captured ? 'захвачен' : 'уничтожен'}: ${t.def.name}! +${pts} б.`, 'kill');
    if (src && src.card) src.kills = (src.kills || 0) + 1;
  }

  function titanTarget(t) {
    if (t.forcedT > 0 && t.forced && reachable(t.forced)) return t.forced;
    const def = t.def;
    let best = null, bd = 1e9;
    const aggro = def.aggro * (t.enrageT > 0 ? 1.5 : 1);
    for (const u of G.units) {
      if (!reachable(u)) continue;
      const d = A.dist(t, u);
      let score = d;
      if (def.hunter) { if (u.card.kind !== 'hero') score *= 2.5; if (d > 700) continue; }
      else if (d > aggro) continue;
      // беспомощный Эрен — лакомая цель
      if (u.card.ability === 'shifter' && u.form === 'human' && u.state !== 'deploy') score *= 0.4;
      if (u.order && u.order.kind === 'seal') score *= 0.5;
      if (score < bd) { bd = score; best = u; }
    }
    return best;
  }

  function moveEnt(e, tx, ty, spd, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d < 0.5) return true;
    const s = Math.min(d, spd * dt);
    e.x += (dx / d) * s; e.y += (dy / d) * s;
    if (Math.abs(dx) > 0.5) e.face = dx > 0 ? 1 : -1;
    return d <= spd * dt;
  }

  function titanMelee(t) {
    if (t.atkT > 0 || t.blindT > 0 || t.stunT > 0) return;
    const reach = t.def.reach + t.def.w * 0.5 + 4;
    let victim = null, vd = 1e9;
    for (const u of G.units) {
      if (!A.unitAlive(u)) continue;
      const canReachWall = t.type === 'colossal' && u.onWall;
      if (!reachable(u) && !canReachWall) continue;
      const d = A.dist(t, u) - (u.target === t ? 6 : 0);
      if (d < reach && d < vd) { vd = d; victim = u; }
    }
    if (!victim) return;
    t.atkT = t.def.atkCd * A.rand(0.8, 1.2);
    t.grabT = 0.6;
    let p = t.def.acc * (1 - effEva(victim));
    if (victim.order && victim.order.kind === 'charge') p *= 1.2;
    if (t.enrageT > 0) p *= 1.2;
    if (A.chance(p)) A.hitUnit(victim, t, 'melee');
    else if (A.chance(0.3)) A.float(victim.x, victim.y - 12, 'Уклон', '#cfe3ff');
  }

  function updateTitan(t, dt) {
    if (t.dead) { t.deadT += dt; return; }
    for (const k of ['atkT', 'blindT', 'stunT', 'markT', 'rootT', 'hardenT', 'hardenCd', 'forcedT', 'enrageT', 'grabT', 'disarmT', 'distractT', 'wallHitT', 'hitFlash']) if (t[k] > 0) t[k] -= dt;
    const def = t.def;
    let spd = def.speed * G.spdMul * (t.enrageT > 0 ? 1.4 : 1);
    if (t.blindT > 0) { t.anim += dt * 3; return; }
    if (t.stunT > 0) return;
    if (def.steam) colossalSteam(t, dt);
    if (t.rootT > 0) { titanMelee(t); return; }
    t.anim += dt * spd * 0.12;

    // ----- Звероподобный -----
    if (def.thrower && !t.outOfRocks) {
      if (!t.retreating && t.hp < t.maxHp * 0.3) {
        t.retreating = true;
        A.log('Дозор', 'Звероподобный тяжело ранен и отступает за горизонт! Успейте добить!', 'warn');
      }
      if (t.retreating) {
        const n = A.roseNormal(t.x, t.y);
        moveEnt(t, t.x + n.x * 100, t.y + n.y * 100, spd * 2.2, dt);
        if (A.rFromC(t.x, t.y) >= A.R.maria - 40) { t.dead = true; t.deadT = 99; t.escaped = true; A.log('Дозор', 'Звероподобный ушёл. Баллов за него не будет.', 'warn'); }
        titanMelee(t); return;
      }
      if (SDE(t) > def.holdSd + 2) { const g = gateTarget(t); moveEnt(t, g.x, g.y, spd, dt); }
      else if (t.disarmT <= 0 && t.distractT <= 0) {
        t.throwT -= dt;
        if (t.throwT <= 0) {
          beastThrow(t); t.throwT = G.units.some((u) => u.order && u.order.kind === 'charge') ? 3.2 : 5.2;
          t.rocks = (t.rocks == null ? 14 : t.rocks) - 1;
          if (t.rocks <= 0) { t.outOfRocks = true; A.log('Дозор', 'У Звероподобного кончились камни — он сам идёт к стене!', 'warn'); }
        }
      }
      titanMelee(t); return;
    }

    // ----- общие: цель — люди рядом или ворота -----
    let tgt = titanTarget(t);
    if (def.erratic && tgt && t.ignoreT > 0) tgt = null;
    if (def.erratic) {
      t.ignoreT = (t.ignoreT || 0) - dt;
      t.leapT -= dt;
      if (t.leapT <= 0 && !t.leap) {
        t.leapT = A.rand(2.5, 5.5);
        let tx, ty;
        if (tgt && A.chance(0.5)) { tx = tgt.x; ty = tgt.y; }
        else {
          const n = A.roseNormal(t.x, t.y), f = A.rand(40, 140), sd = A.rand(-130, 130);
          tx = t.x - n.x * f + n.y * sd; ty = t.y - n.y * f - n.x * sd;
          if (A.chance(0.35)) t.ignoreT = 3;
        }
        const d = Math.hypot(tx - t.x, ty - t.y) || 1;
        t.leap = { vx: (tx - t.x) / d * spd * 4.5, vy: (ty - t.y) / d * spd * 4.5, time: Math.min(0.8, d / (spd * 4.5)) };
        A.float(t.x, t.y - def.h - 4, '!', '#ffcf6a');
      }
      if (t.leap) {
        t.x += t.leap.vx * dt; t.y += t.leap.vy * dt; t.leap.time -= dt;
        if (t.leap.time <= 0) { t.leap = null; t.atkT = Math.min(t.atkT, 0.05); }
        clampTitan(t); wallContact(t, dt); titanMelee(t); return;
      }
    }
    let tx, ty;
    if (tgt) { tx = tgt.x; ty = tgt.y; } else { const g = gateTarget(t); tx = g.x; ty = g.y; }
    if (def.charge && !tgt) {
      if (SDE(t) < 380 && t.wallHitT <= 0) { spd = def.charge * G.spdMul; t.charging = true; }
    }
    const reach = def.reach + def.w * 0.5;
    if (!(tgt && A.dist(t, tgt) < reach * 0.8)) moveEnt(t, tx, ty, spd, dt);
    clampTitan(t);
    wallContact(t, dt);
    titanMelee(t);
  }

  function clampTitan(t) {
    const n = A.roseNormal(t.x, t.y);
    const min = HALF() + t.def.w * 0.5;
    if (n.sd < min) { t.x += n.x * (min - n.sd); t.y += n.y * (min - n.sd); }
    const rr = A.rFromC(t.x, t.y), mx = A.R.maria - 20;
    if (rr > mx) { t.x = A.C.x + (t.x - A.C.x) * mx / rr; t.y = A.C.y + (t.y - A.C.y) * mx / rr; }
  }

  function wallContact(t, dt) {
    if (SDE(t) > HALF() + t.def.w * 0.5 + 1.5) return;
    const wp = A.wallPoint(t.x, t.y, HALF() + 2);
    G.lastHit = t.district;
    if (t.def.charge && t.charging) {
      G.wallHp -= G.wallMax * t.def.wallHit;
      G.shake = 0.8; t.charging = false; t.wallHitT = 15; t.x += wp.nx * 60; t.y += wp.ny * 60;
      A.dust(wp.x, wp.y, 2);
      A.log('Стена', `Бронированный протаранил стену! (−${Math.round(t.def.wallHit * 100)}% прочности)`, 'warn');
      return;
    }
    if (t.def.steam && !t.kicked) {
      t.kicked = true;
      G.wallHp -= G.wallMax * t.def.wallHit; G.shake = 1.5;
      A.dust(wp.x, wp.y, 3);
      A.log('Стена', `Колоссальный ударил по стене! (−${Math.round(t.def.wallHit * 100)}% прочности)`, 'warn');
    }
    G.wallHp -= t.def.wallDps * dt;
    t.atWall = true;
    if (Math.random() < dt * 0.8) A.dust(wp.x + A.rand(-5, 5), wp.y + A.rand(-5, 5), 0.4);
  }

  function colossalSteam(t, dt) {
    if (SDE(t) > 520) return;
    t.steamT -= dt;
    if (t.steamT <= 0) {
      t.steamOn = !t.steamOn;
      t.steamT = t.steamOn ? 9 : 6;
      A.float(t.x, t.y - t.def.h - 8, t.steamOn ? 'ПАР!' : 'Пар иссяк — загривок открыт', t.steamOn ? '#ffffff' : '#9fffb0', true);
    }
    if (t.steamOn) {
      if (Math.random() < dt * 6) A.puff(t.x + A.rand(-20, 20), t.y, A.rand(20, 110), { n: 2, col: ['#ffffff', '#e6e6e6'], spd: 25, up: 15, life: 1.6, size: 4, grow: 6 });
      t.steamTick -= dt;
      if (t.steamTick <= 0) {
        t.steamTick = 1;
        for (const u of G.units) {
          if (!A.unitAlive(u)) continue;
          const inRange = A.dist(t, u) < 130 && (reachable(u) || (u.onWall && t.atWall && Math.abs(u.y - t.y) < 160));
          if (!inRange) continue;
          const p = u.card.kind === 'squad' ? 0.35 : u.card.ability === 'shifter' ? 1 : (1 - effEva(u)) * 3;
          if (A.chance(p)) A.hitUnit(u, t, 'steam');
        }
      }
    }
  }

  function beastThrow(t) {
    const range = t.def.throwRange;
    const cands = G.units.filter((u) => A.unitAlive(u) && A.dist(t, u) < range && SDE(u) > -60);
    let tx, ty, onWallOnly = false;
    const chargers = cands.filter((u) => u.order && u.order.kind === 'charge');
    const pool = chargers.length ? chargers : cands;
    if (pool.length) {
      let best = pool[0], bs = -1;
      for (const u of pool) {
        let s = 0;
        for (const o of pool) if (A.dist(u, o) < 55) s += A.unitStrength(o) || 1;
        if (u.card.ability === 'shifter' && u.form === 'titan') s += 3;
        if (s > bs) { bs = s; best = u; }
      }
      tx = best.x + A.rand(-10, 10); ty = best.y + A.rand(-10, 10);
    } else { const wp = A.wallPoint(t.x, t.y, 0); tx = wp.x + A.rand(-20, 20); ty = wp.y + A.rand(-20, 20); onWallOnly = true; }
    t.grabT = 0.8;
    A.float(t.x, t.y - t.def.h - 6, 'Бросок!', '#e0d0b0');
    for (let i = 0; i < 4; i++) {
      const fx = tx + A.rand(-30, 30), fy = ty + A.rand(-30, 30);
      G.projs.push({
        kind: 'rock', x0: t.x, y0: t.y, z0: t.def.h, x1: fx, y1: fy, t: 0, dur: 1.5 + i * 0.08, arc: 160,
        onHit: () => rockLand(fx, fy, onWallOnly),
      });
    }
  }
  function rockLand(x, y, wallShot) {
    A.dust(x, y, 1.1);
    G.shake = Math.max(G.shake, 0.3);
    if (wallShot || A.onRoseWall(x, y)) G.wallHp -= G.wallMax * 0.003;
    let n = 0;
    for (const u of G.units) {
      if (!A.unitAlive(u) || A.distXY(u.x, u.y, x, y) > 34) continue;
      if (u.card.kind === 'squad') {
        const before = u.members;
        for (let i = 0; i < before; i++) if (A.chance(0.4)) { A.hitUnit(u, null, 'rock'); n++; if (u.dead) break; }
      } else if (u.card.ability === 'shifter') { A.hitUnit(u, null, 'rock'); n++; }
      else if (A.chance((1 - effEva(u)) * 4)) { A.hitUnit(u, null, 'rock'); n++; }
    }
    if (n) G.rockHits.push({ t: G.t, n });
  }

  // ---------- Юниты ----------
  function moveUnit(u, x, y, dt, mul) {
    const a = u.onWall || SDE(u) < 0 ? 1 : A.anchorAt(u.x, u.y);
    const spd = u.card.speed * (0.7 + 0.3 * a) * (mul || 1);
    return moveEnt(u, x, y, spd, dt);
  }

  function threatensWeakAlly(t, self) {
    for (const u of G.units) {
      if (u === self || !reachable(u)) continue;
      const weak = (u.card.kind === 'squad' && u.members <= 2) || (u.card.kind === 'hero' && u.hp <= 1) || u.card.ability === 'analyst' || (u.card.ability === 'shifter' && u.form === 'human');
      if (weak && A.dist(t, u) < t.def.reach + t.def.w * 0.5 + 30) return true;
    }
    return false;
  }

  function chooseTarget(u) {
    const c = u.card;
    let best = null, bs = -1;
    for (const t of G.titans) {
      if (t.dead || SDE(t) > A.DEPLOY_OUT + 250) continue;
      const dU = A.dist(u, t), dP = A.distXY(u.post.x, u.post.y, t.x, t.y);
      if (dU > c.sense && dP > c.leash) continue;
      if (dP > c.leash * 1.3 + 40) continue;
      if (t.def.steam && t.steamOn) continue;
      if (t.armor > 0.5 && c.ability !== 'spin' && c.ability !== 'shifter') continue; // лезвия против брони бесполезны
      let s = (Math.sqrt(t.def.pts) + 1) / (dU + 80);
      if (SDE(t) < 260) s *= 1.8;
      if (t.atWall) s *= 1.5;
      switch (c.ability) {
        case 'spin': if (t.def.special) s *= 3; break;
        case 'guardian':
          if (threatensWeakAlly(t, u)) s *= 4;
          if (t.def.special) s *= 1.6;
          break;
        case 'archer': if (t.def.erratic || t.type === 'jaw') s *= 3; if (t.blindT > 0) s *= 0.3; break;
        case 'scientist': if (['small', 'normal', 'deviant'].includes(t.type) && t.hp < t.maxHp * 0.5) s *= 3; break;
        case 'analyst': if (dU > 130) s *= 0.05; if (t.def.special) s *= 0.1; break;
        case 'commander': if (t.def.special) s *= 0.3; break;
      }
      if (c.kind === 'squad' && t.def.special && t.type !== 'beast') s *= 0.4;
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }

  function engage(u, dt) {
    const t = u.target;
    if (!t || t.dead) { u.target = null; u.state = 'return'; return; }
    const c = u.card;
    const ordered = u.order && (u.order.kind === 'focus' || u.order.kind === 'charge' || u.order.kind === 'flank');
    if (!ordered) {
      if (t.def.steam && t.steamOn && A.dist(u, t) < 170) { u.target = null; u.state = 'return'; u.thought = 'Пар! Отходит от Колоссального'; return; }
      if (A.distXY(u.post.x, u.post.y, t.x, t.y) > c.leash * 1.6 + 40) { u.target = null; u.state = 'return'; u.thought = 'Возвращается на позицию'; return; }
    }
    const ranged = c.range;
    const reach = ranged ? ranged : t.def.w * 0.5 + 6;
    const d = A.dist(u, t);
    if (d > reach) {
      if (ranged) {
        const k = (d - ranged * 0.85) / d;
        moveUnit(u, u.x + (t.x - u.x) * k, u.y + (t.y - u.y) * k, dt);
      } else {
        const side = u.id % 2 ? 1 : -1;
        moveUnit(u, t.x + side * (t.def.w * 0.5 + 3), t.y + 2, dt, u.order && u.order.kind === 'flank' ? 1.3 : 1);
      }
      u.z = A.lerp(u.z, ranged ? 0 : 6, dt * 3);
      u.thought = ranged ? `Выходит на дистанцию выстрела: ${t.def.name}` : `Летит к цели: ${t.def.name}`;
    } else {
      u.z = A.lerp(u.z, ranged ? 0 : t.def.h * 0.75, dt * 5);
      u.thought = ranged ? `Стреляет по: ${t.def.name}` : `Атакует загривок: ${t.def.name}`;
      if (u.atkT <= 0) doAttack(u, t);
    }
  }

  function dmgMul(u) {
    let m = 1;
    if (G.auras.jean && u.card.id !== 'jean' && A.distXY(u.x, u.y, G.auras.jean.x, G.auras.jean.y) < 180) m *= 1.25;
    if (G.auras.erwin && u.card.faction === 'survey') m *= 1.1;
    if (u.order && u.order.bonus) m *= u.order.bonus;
    return m;
  }

  function doAttack(u, t) {
    const c = u.card;
    u.atkT = c.atkCd * A.rand(0.9, 1.1);
    let dmg = c.dmg * dmgMul(u);
    if (c.kind === 'squad') dmg *= u.members;
    if (c.range) {
      // стрела
      const blind = A.chance(0.4);
      G.projs.push({
        kind: 'arrow', x0: u.x, y0: u.y, z0: 6, x1: t.x, y1: t.y, z1: t.def.h * 0.9, t: 0, dur: 0.3, arc: 6,
        onHit: () => {
          if (t.dead) return;
          A.damageTitan(t, dmg, u, {});
          if (blind && t.blindT <= 0 && t.type !== 'colossal') { t.blindT = 2.4; A.float(t.x, t.y - t.def.h - 4, 'Ослеплён', '#e8f0a0'); }
        },
      });
      u.gas = Math.max(0, u.gas - c.gasUse * 0.5);
      return;
    }
    u.gas = Math.max(0, u.gas - (c.gasUse || 4));
    const a = A.anchorAt(u.x, u.y);
    dmg *= 0.45 + 0.55 * a;
    let opts = { melee: true };
    if (c.ability === 'guardian' && A.chance(0.2)) { dmg *= 2; A.float(t.x, t.y - t.def.h - 8, 'Крит!', '#ff9aa2'); }
    if (u.order && u.order.kind === 'flank' && t === u.order.target && !u.order.struck) {
      u.order.struck = true; dmg *= 3; t.disarmT = 25;
      A.log('Леви Аккерман', 'Зашёл с фланга и изрубил руки Звероподобного — броски прекращены на 25 сек.', 'order');
      A.float(t.x, t.y - t.def.h - 10, 'Руки отрублены!', '#ffffff', true);
    }
    A.damageTitan(t, dmg, u, opts);
    A.sparks(t.x + A.rand(-3, 3), t.y, t.def.h * 0.85);
    if (c.ability === 'spin') {
      for (const o of G.titans) if (o !== t && !o.dead && A.dist(o, t) < 45) { A.damageTitan(o, dmg * 0.6, u, opts); A.sparks(o.x, o.y, o.def.h * 0.85); }
      A.puff(u.x, u.y, u.z, { n: 6, col: ['#ffffff', '#cfe0ff'], spd: 50, up: 0, life: 0.2, size: 1, grow: 0 });
    }
  }

  function updateCannon(u, dt) {
    u.atkT -= dt;
    u.thought = 'Расчёт у орудия';
    if (u.atkT > 0) return;
    const c = u.card.cannon;
    let best = null, bd = 1e9;
    for (const t of G.titans) {
      if (t.dead) continue;
      const sdT = SDE(t), du = A.dist(t, u);
      if (sdT > c.range || du > c.range + 160) continue;
      const s = sdT + du * 0.5 - (t.atWall ? 200 : 0);
      if (s < bd) { bd = s; best = t; }
    }
    if (!best) { u.atkT = 0.5; u.thought = 'Ждёт цель в секторе обстрела'; return; }
    const pyx = !!G.auras.pyxis;
    u.atkT = c.cd * (pyx ? 0.72 : 1) * A.rand(0.9, 1.1);
    const crew = u.members / u.maxMembers;
    const dmg = c.dmg * (pyx ? 1.4 : 1) * (0.4 + 0.6 * crew);
    const lead = best.def.speed * 0.6;
    const bn = A.roseNormal(best.x, best.y);
    const tx = best.x - bn.x * lead, ty = best.y - bn.y * lead;
    const mp = A.wallPoint(u.x, u.y, HALF() - 2);
    const sx = mp.x, sy = mp.y;
    A.puff(sx, sy, 8, { n: 4, col: ['#d8d8d8', '#b0b0b0'], spd: 10, up: 6, life: 0.9, size: 2, grow: 3 });
    A.puff(sx + mp.nx * 3, sy + mp.ny * 3, 8, { n: 3, col: ['#ffd25a', '#ff9a3a'], spd: 20, up: 2, life: 0.15, size: 1, grow: 1 });
    u.thought = `Огонь по: ${best.def.name}`;
    G.projs.push({
      kind: 'ball', x0: sx, y0: sy, z0: 10, x1: tx, y1: ty, t: 0, dur: 0.75, arc: 30,
      onHit: () => {
        A.puff(tx, ty, 2, { n: 6, col: ['#5a5654', '#8a8580'], spd: 14, up: 8, life: 0.8, size: 2, grow: 3 });
        for (const t of G.titans) if (!t.dead && A.distXY(t.x, t.y, tx, ty) < c.aoe + t.def.w * 0.5) A.damageTitan(t, dmg, 'cannon', { armorPen: 0.5 });
      },
    });
  }

  function updatePyxis(u, dt) {
    u.abilT -= dt;
    if (u.abilT > 0) return;
    u.abilT = 9;
    const crews = G.units.filter((o) => A.unitAlive(o) && o.onWall && o.card.cannon);
    const targets = G.titans.some((t) => !t.dead && SDE(t) < 400);
    if (crews.length >= 2 && targets) {
      crews.forEach((o) => { o.atkT = Math.min(o.atkT, A.rand(0, 0.25)); });
      A.float(u.x, u.y - 16, 'Залп!', '#ffd45a');
      u.thought = `Скомандовал общий залп (${crews.length} расчётов)`;
    } else u.thought = crews.length ? 'Наблюдает за подступами' : 'Нет расчётов гарнизона на стене';
  }

  function abilityTick(u, dt) {
    const c = u.card;
    u.abilT -= dt;
    if (u.abilT > 0) return;
    switch (c.ability) {
      case 'analyst': {
        u.abilT = 1.5;
        let marked = 0;
        for (const t of G.titans) {
          if (t.dead || A.dist(u, t) > 230) continue;
          t.markT = 3; marked++;
          if (t.def.special && !G.analyzed[t.type]) {
            G.analyzed[t.type] = true;
            const notes = {
              jaw: 'у Челюстного уязвимы ноги — бейте, пока он в прыжке',
              female: 'Женская особь отвердевает только там, куда бьют — нужно отвлечь и бить одновременно',
              armored: 'суставы Бронированного не покрыты бронёй — нужны копья, а не лезвия',
              beast: 'Звероподобный метает камни только стоя на месте — к нему нужно подобраться с фланга',
              colossal: 'Колоссальный тратит себя на пар — переждите, и он истощится',
            };
            A.log('Армин Арлерт', `Разгадал противника: ${notes[t.type]}. (+10% урона по нему до конца игры)`, 'order');
          }
        }
        if (marked) u.thought = `Помечает слабые места: ${marked} тит.`;
        break;
      }
      case 'decoy': {
        u.abilT = 1;
        if (u.tauntCd > 0) { u.tauntCd -= 1; break; }
        for (const a of G.units) {
          if (a === u || !reachable(a)) continue;
          const weak = (a.card.kind === 'squad' && a.members <= 2) || (a.card.kind === 'hero' && a.hp <= 1) || a.card.ability === 'analyst' || (a.card.ability === 'shifter' && a.form === 'human');
          if (!weak) continue;
          const near = G.titans.filter((t) => !t.dead && A.dist(t, a) < 100);
          if (!near.length || A.dist(u, a) > 420) continue;
          near.forEach((t) => { t.forced = u; t.forcedT = 4.5; });
          u.target = near[0]; u.state = 'engage'; u.tauntCd = 9;
          A.float(u.x, u.y - 14, 'Эй, громила, сюда!', '#ffe08a');
          u.thought = `Отвлекает ${near.length} тит. от: ${a.card.name}`;
          break;
        }
        break;
      }
      case 'scientist': {
        u.abilT = 1;
        if ((u.capCd || 0) > 0) { u.capCd -= 1; break; }
        for (const t of G.titans) {
          if (t.dead || !['small', 'normal', 'deviant'].includes(t.type)) continue;
          if (A.dist(u, t) > 170 || t.hp > t.maxHp * 0.35) continue;
          t.hp = 0; t.dead = true; t.deadT = 0; t.captured = true;
          const pts = Math.round(t.def.pts * 1.5);
          G.points += pts; G.kills++; G.killsBy[t.type] = (G.killsBy[t.type] || 0) + 1;
          A.float(t.x, t.y - t.def.h - 4, `В плену! +${pts}`, '#c8a0ff', true);
          A.log('Ханджи Зоэ', `Захватила ${t.def.name.toLowerCase()} живьём для опытов (+${pts} б.)`, 'kill');
          u.capCd = 22; u.thought = 'Опутала титана тросами — в лабораторию!';
          break;
        }
        // без Эрвина сама применяет копья против брони
        if (!G.auras.erwin && G.spears > 0 && !u.order) {
          const arm = G.titans.find((t) => !t.dead && t.armor > 0.5 && A.dist(u, t) < 500);
          if (arm) { u.order = { kind: 'spear', target: arm, exp: G.t + 15 }; A.log('Ханджи Зоэ', 'Эрвина нет — сама веду звено с копьями на Бронированного.', 'order'); }
        }
        break;
      }
      case 'leader': {
        u.abilT = 2;
        for (const a of G.units) {
          if (a === u || !reachable(a) || a.card.kind !== 'squad' || a.members > 1 || a.state === 'resupply') continue;
          if (A.dist(u, a) > 200) continue;
          a.state = 'resupply'; a.target = null; a.thought = 'Жан приказал выйти из боя';
          A.log('Жан Кирштейн', `«${a.card.name}, отходите к складу — вас почти не осталось!»`, 'order');
        }
        break;
      }
      default: u.abilT = 2;
    }
  }

  // ----- Эрен -----
  function erenEmerge(u, reason) {
    u.form = 'human'; u.state = 'exhausted'; u.target = null; u.order = null; u.z = 0;
    A.steamBurst(u.x, u.y, 30);
    A.log('Эрен Йегер', `Выбрался из тела титана (${reason}). Истощён — нужно прикрыть, пока он добирается до стены!`, 'warn');
    u.thought = 'Истощён, ползёт к стене';
  }
  function updateEren(u, dt) {
    const c = u.card;
    if (u.state === 'deploy') {
      u.thought = 'Бежит к месту превращения';
      if (moveEnt(u, u.post.x, u.post.y, 95, dt)) { u.state = 'transform'; u.trT = 0.8; }
      return;
    }
    if (u.state === 'transform') {
      u.trT -= dt;
      if (u.trT <= 0) {
        u.form = 'titan'; u.state = 'idle';
        if (u.pendingSeal) { u.pendingSeal = false; u.order = { kind: 'seal', step: 0 }; }
        G.fx.push({ x: u.x, y: u.y, z: 0, flash: true, life: 0.5, max: 0.5, size: 40, col: '#fff3a0', vx: 0, vy: 0, vz: 0, grow: 0 });
        A.steamBurst(u.x, u.y, 30);
        for (const t of G.titans) if (!t.dead && A.dist(t, u) < 90) t.stunT = 2;
        A.log('Эрен Йегер', 'Превратился в титана! Ближайшие титаны оглушены.', 'order');
      }
      return;
    }
    if (u.state === 'exhausted') {
      // ползёт к ближайшей стене — оттуда его поднимут на тросах
      const wp = A.wallPoint(u.x, u.y, HALF() + 4);
      u.thought = 'Истощён, ползёт к стене';
      if (SDE(u) <= HALF() + 6 || moveEnt(u, wp.x, wp.y, 34, dt)) {
        u.state = 'safe'; G.erenRest = true;
        A.log('Эрен Йегер', 'Его подняли на стену. Восстановится к следующей волне.', 'info');
      }
      return;
    }
    // ---- форма титана ----
    u.stamina -= dt;
    if (u.stamina <= 0) { erenEmerge(u, 'силы иссякли'); return; }
    if (u.order && u.order.kind === 'seal') { erenSeal(u, dt); return; }
    if (!G.sealed && G.wallHp < G.wallMax * 0.3 && !G.auras.erwin) {
      u.order = { kind: 'seal', step: 0 };
      A.log('Эрен Йегер', '«Стена вот-вот рухнет — я заткну пролом валуном!»', 'order');
      return;
    }
    if (!u.target || u.target.dead || A.distXY(u.post.x, u.post.y, u.target.x, u.target.y) > c.leash * 1.4) {
      u.target = null;
      let best = null, bs = -1;
      for (const t of G.titans) {
        if (t.dead) continue;
        const dP = A.distXY(u.post.x, u.post.y, t.x, t.y);
        if (dP > c.leash) continue;
        let s = (t.def.size + (SDE(t) < 250 ? 2 : 0)) / (A.dist(u, t) + 60);
        if (t.def.steam && t.steamOn) s *= 0.1;
        if (s > bs) { bs = s; best = t; }
      }
      u.target = best;
    }
    const t = u.target;
    if (!t) { u.thought = `Ждёт врага. Сил: ${Math.ceil(u.stamina)} с`; moveEnt(u, u.post.x, u.post.y, c.speed, dt); return; }
    const reach = t.def.w * 0.5 + 9;
    if (A.dist(u, t) > reach) { moveEnt(u, t.x + (u.x < t.x ? -reach * 0.8 : reach * 0.8), t.y, c.speed, dt); u.thought = `Идёт на: ${t.def.name}`; }
    else if (u.atkT <= 0) {
      u.atkT = c.atkCd;
      const pen = t.armor > 0.5 ? 0.6 : 0;
      A.damageTitan(t, c.dmg, u, { melee: true, armorPen: pen });
      for (const o of G.titans) if (o !== t && !o.dead && A.dist(o, t) < 30) A.damageTitan(o, c.dmg * 0.5, u, { melee: true });
      A.dust(t.x, t.y, 0.5);
      u.punch = 0.25;
      u.thought = `Дерётся врукопашную: ${t.def.name}`;
    }
  }
  function erenSeal(u, dt) {
    const o = u.order;
    if (o.district == null) o.district = G.lastHit != null ? G.lastHit : A.nearestDistrict(u.x, u.y).idx;
    const D = A.DISTRICTS[o.district], B = A.BOULDERS[o.district];
    const gateOut = { x: D.gx + D.nx * 16, y: D.gy + D.ny * 16 }, gateIn = { x: D.gx - D.nx * 22, y: D.gy - D.ny * 22 };
    u.thought = `Несёт валун к воротам района ${D.name}`;
    if (o.step === 0) { // к воротам района снаружи
      if (SDE(u) < 0 || moveEnt(u, gateOut.x, gateOut.y, 40, dt)) o.step = 1;
    } else if (o.step === 1) { // внутрь, к валуну
      if (moveEnt(u, B.x + 14, B.y + 4, 40, dt)) { o.step = 2; u.carry = true; A.dust(B.x, B.y, 1); }
    } else if (o.step === 2) { // в проём ворот
      if (moveEnt(u, gateIn.x, gateIn.y, 28, dt)) {
        G.sealed = true; G.sealedAt = o.district; u.carry = false;
        G.wallHp = Math.min(G.wallMax, G.wallHp + G.wallMax * 0.4);
        A.dust(D.gx, D.gy, 3); G.shake = 1;
        A.log('Эрен Йегер', `Валун вбит в ворота района ${D.name}! Стена восстановлена на 40%.`, 'kill');
        A.float(D.gx, D.gy - 40, 'ПРОЛОМ ЗАКРЫТ', '#9fffb0', true);
        u.order = null; erenEmerge(u, 'выложился до конца');
      }
    }
  }

  function updateUnit(u, dt) {
    if (u.dead) { u.deadT += dt; return; }
    if (u.state === 'safe') return;
    u.anim += dt;
    if (u.atkT > 0) u.atkT -= dt;
    if (u.punch > 0) u.punch -= dt;
    const c = u.card;
    if (c.ability === 'shifter') return updateEren(u, dt);
    if (c.wallOnly || (u.onWall && c.cannon)) {
      if (A.distXY(u.x, u.y, u.post.x, u.post.y) > 4) { // перебегает на новую позицию
        u.z = A.lerp(u.z, 3, dt * 2); moveUnit(u, u.post.x, u.post.y, dt, 1.2);
        u.thought = 'Перебирается на новую позицию'; return;
      }
      u.z = 0; if (u.state === 'deploy' || u.state === 'return') u.state = 'idle';
      return c.wallOnly ? updatePyxis(u, dt) : updateCannon(u, dt);
    }

    if (u.order && u.order.exp && G.t > u.order.exp) { u.order = null; u.state = 'return'; }
    if (u.order && A.handleOrder && A.handleOrder(u, dt)) { abilityTick(u, dt); return; }

    if (u.gas < 15 && !c.range && u.state !== 'resupply' && u.state !== 'refill') {
      u.state = 'resupply'; u.target = null; u.thought = 'Газ на исходе — летит к складу';
    }
    switch (u.state) {
      case 'deploy':
        u.z = A.lerp(u.z, 4, dt * 2);
        if (moveUnit(u, u.post.x, u.post.y, dt)) u.state = 'idle';
        break;
      case 'resupply': {
        const s = nearestSupply(u.x, u.y);
        u.z = A.lerp(u.z, 4, dt * 2);
        if (moveUnit(u, s.x, s.y, dt, 1.1)) { u.state = 'refill'; u.refillT = 3; u.thought = 'Меняет баллоны и клинки'; }
        break;
      }
      case 'refill':
        u.refillT -= dt; u.z = 0;
        if (u.refillT <= 0) {
          u.gas = 100; u.state = 'return';
          if (c.kind === 'hero' && u.hp < u.maxHp && u.hp <= 1) { u.hp++; u.thought = 'Перевязан(а), возвращается'; }
        }
        break;
      case 'return': {
        const t = chooseTarget(u);
        if (t) { u.target = t; u.state = 'engage'; break; }
        u.thought = 'Возвращается на позицию';
        if (moveUnit(u, u.post.x, u.post.y, dt)) u.state = 'idle';
        u.z = A.lerp(u.z, 2, dt * 2);
        break;
      }
      case 'idle': {
        u.z = A.lerp(u.z, 0, dt * 3);
        u.idleScan = (u.idleScan || 0) - dt;
        if (u.idleScan <= 0) {
          u.idleScan = 0.3;
          const t = chooseTarget(u);
          if (t) { u.target = t; u.state = 'engage'; break; }
        }
        if (A.distXY(u.x, u.y, u.post.x, u.post.y) > 3) moveUnit(u, u.post.x, u.post.y, dt);
        u.thought = u.onWall ? 'Дежурит на стене' : 'Держит позицию';
        break;
      }
      case 'engage':
        engage(u, dt);
        break;
    }
    abilityTick(u, dt);
  }

  // ---------- Снаряды и частицы ----------
  function updateProjs(dt) {
    for (const p of G.projs) {
      p.t += dt;
      if (p.t >= p.dur && !p.done) { p.done = true; if (p.onHit) p.onHit(); }
    }
    G.projs = G.projs.filter((p) => !p.done);
  }
  function updateFx(dt) {
    for (const f of G.fx) {
      f.life -= dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      f.vz -= (f.g || 0) * dt; f.vx *= 1 - dt * 1.5; f.vy *= 1 - dt * 1.5;
      if (!f.g) f.vz *= 1 - dt * 0.8;
      if (f.z < 0) f.z = 0;
      if (f.flare && f.life < f.max - 0.05 && Math.random() < 0.7) {
        G.fx.push({ x: f.x, y: f.y, z: f.z, vx: 0, vy: 0, vz: 2, life: 2.5, max: 2.5, size: 2, grow: 4, col: f.trail, smokeTrail: true });
      }
    }
    G.fx = G.fx.filter((f) => f.life > 0);
    if (G.fx.length > 2500) G.fx.splice(0, G.fx.length - 2500);
    for (const f of G.floaters) { f.life -= dt; f.y -= dt * 12; }
    G.floaters = G.floaters.filter((f) => f.life > 0);
  }

  function separate() {
    const ts = G.titans;
    for (let i = 0; i < ts.length; i++) {
      const a = ts[i]; if (a.dead) continue;
      for (let j = i + 1; j < ts.length; j++) {
        const b = ts[j]; if (b.dead) continue;
        const min = (a.def.w + b.def.w) * 0.42;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < min) {
          const push = (min - d) * 0.5;
          const ma = a.def.size, mb = b.def.size, s = ma + mb;
          a.x -= (dx / d) * push * (mb / s) * 2; a.y -= (dy / d) * push * (mb / s) * 2;
          b.x += (dx / d) * push * (ma / s) * 2; b.y += (dy / d) * push * (ma / s) * 2;
        }
      }
    }
  }

  // ---------- Волны ----------
  A.startWave = function () {
    if (G.phase !== 'prep') return;
    G.wave++;
    G.phase = 'wave';
    G.queue = G.nextQueue || prepQueue(G.wave);
    G.nextQueue = null;
    G.waveT = 0;
    G.hpMul = A.waveHpMul(G.wave);
    G.spdMul = A.waveSpeedMul(G.wave);
    if (G.erenRest) {
      G.erenRest = false; G.hand.eren++;
      G.units = G.units.filter((u) => !(u.card.id === 'eren' && u.state === 'safe'));
      A.log('Эрен Йегер', 'Восстановился — карточка вернулась в резерв.', 'info');
    }
    for (const u of G.units) {
      if (!A.unitAlive(u)) continue;
      if (u.card.ability === 'scientist') { G.spears++; A.log('Ханджи Зоэ', 'Собрала в мастерской ещё одно громовое копьё (+1).', 'info'); }
    }
    const counts = {};
    G.queue.forEach((q) => { counts[q.type] = (counts[q.type] || 0) + 1; });
    const specials = Object.keys(counts).filter((k) => A.TITANS[k].special).map((k) => A.TITANS[k].name);
    const where = G.queue.dirs.map((i) => `${A.DISTRICTS[i].name} (${A.DISTRICTS[i].dir})`).join(', ');
    A.log('Дозор', `Волна ${G.wave}: ${G.queue.length} титанов идут на район ${where}.` + (specials.length ? ` Среди них: ${specials.join(', ')}!` : ''), specials.length ? 'warn' : 'info');
    if (A.onWaveStart) A.onWaveStart(G.queue.dirs);
  };

  function prepQueue(n) {
    const q = A.buildWave(n), dirs = A.waveDirs(n);
    q.forEach((it) => { it.dir = A.TITANS[it.type].special ? dirs[0] : A.pick(dirs); });
    q.dirs = dirs;
    return q;
  }
  A.prepQueue = prepQueue;

  function waveClear() {
    G.phase = 'prep';
    G.prepT = 30;
    const bonus = 8 + G.wave * 3;
    G.points += bonus;
    const pyx = !!G.auras.pyxis;
    const rep = G.wallMax * (pyx ? 0.14 : 0.06);
    G.wallHp = Math.min(G.wallMax, G.wallHp + rep);
    for (const u of G.units) {
      if (!A.unitAlive(u)) continue;
      u.gas = 100; u.order = null; u.target = null;
      if (u.card.kind === 'hero' && u.hp < u.maxHp && u.card.ability !== 'shifter') u.hp++;
      if (u.card.ability === 'shifter' && u.form === 'titan') { u.stamina = Math.min(u.card.stamina, u.stamina + 15); }
      if (!u.card.wallOnly && !(u.onWall && u.card.cannon) && u.card.ability !== 'shifter') u.state = 'return';
    }
    A.log('Штаб', `Волна ${G.wave} отбита! Награда: +${bonus} б. Гарнизон подлатал стену (+${Math.round(rep / G.wallMax * 100)}%).`, 'kill');
    A.intel();
  }

  // разведка заранее сообщает о шифтерах в следующей волне
  A.intel = function () {
    const next = prepQueue(G.wave + 1);
    G.nextQueue = next;
    const sp = [...new Set(next.filter((q) => A.TITANS[q.type].special).map((q) => q.type))];
    const where = next.dirs.map((i) => `${A.DISTRICTS[i].name} (${A.DISTRICTS[i].dir})`).join(', ');
    A.log('Разведка', `Следующая волна пойдёт на район ${where}. Готовьте оборону там.`, 'warn');
    if (A.erwinRedeploy) A.erwinRedeploy(next.dirs, true);
    if (!sp.length) return;
    const tips = {
      armored: 'Бронированный: лезвия бесполезны. Нужны громовые копья (Эрвин, Ханджи), Эрен или много пушек.',
      jaw: 'Челюстной: быстрый охотник на героев. Помогут Саша (ослепляет) и Микаса.',
      female: 'Женская особь: отвердевает. Два отряда рядом могут её сковать, если командует Эрвин.',
      beast: 'Звероподобный: камнепад по всему полю. Держите людей за стеной или готовьте Леви/кавалерию.',
      colossal: 'Колоссальный: пар. Атаковать только когда пар иссякнет.',
    };
    A.log('Разведка', `В следующей волне: ${sp.map((t) => tips[t]).join(' ')}`, 'warn');
  };

  function gameOver() {
    G.over = true; G.phase = 'over';
    A.log('Стена', 'Стена Роза пала. Титаны хлынули в город…', 'loss');
    try {
      const best = +localStorage.getItem('aot_best_wave') || 0;
      if (G.wave > best) localStorage.setItem('aot_best_wave', String(G.wave));
    } catch (e) { /* хранилище недоступно */ }
    if (A.onGameOver) A.onGameOver();
  }

  // ---------- Главный шаг ----------
  A.step = function (dt) {
    if (G.over) return;
    G.t += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.5);
    // ауры
    const find = (ab) => G.units.find((u) => A.unitAlive(u) && u.card.ability === ab);
    G.auras.jean = find('leader'); G.auras.armin = find('analyst');
    G.auras.erwin = find('commander'); G.auras.pyxis = find('marshal');

    if (G.phase === 'prep') {
      G.prepT -= dt;
      if (G.prepT <= 0) A.startWave();
    } else if (G.phase === 'wave') {
      G.waveT += dt;
      while (G.queue.length && G.queue[0].t <= G.waveT) { const q = G.queue.shift(); A.spawnTitan(q.type, { district: q.dir }); }
      if (!G.queue.length && !G.titans.some((t) => !t.dead)) waveClear();
    }

    for (const t of G.titans) updateTitan(t, dt);
    separate();
    for (const u of G.units) updateUnit(u, dt);
    if (A.director) A.director(dt);
    updateProjs(dt);
    updateFx(dt);

    G.titans = G.titans.filter((t) => !t.dead || t.deadT < 1.2);
    G.units = G.units.filter((u) => !u.dead || u.deadT < 2);
    G.rockHits = G.rockHits.filter((r) => G.t - r.t < 20);

    if (G.wallHp <= 0) { G.wallHp = 0; gameOver(); }
  };

  A._internal = { moveUnit, moveEnt, chooseTarget, effEva, nearestSupply, erenEmerge, engage };
})(window.AOT);
