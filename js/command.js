// Тактический ИИ: приказы и «мозг» Эрвина Смита
// Эрвин не делает одно и то же каждый раз — он оценивает ситуацию на поле
// и выбирает самый выгодный ход: куда тратить громовые копья, когда жертвовать
// кавалерией, когда отводить людей, кого бросить на помощь.
window.AOT = window.AOT || {};
(function (A) {
  'use strict';
  const W = A.WORLD, G = A.G;
  const SDE = (e) => A.sdRose(e.x, e.y);
  const HALF = () => A.WALL_T.rose / 2;
  const I = () => A._internal;

  const alive = (u) => A.unitAlive(u);
  const isId = (u, id) => u.card.id === id;

  // ---------- Выполнение приказов юнитами ----------
  A.handleOrder = function (u, dt) {
    const o = u.order;
    const { moveUnit, engage } = I();
    switch (o.kind) {
      case 'spear': {
        const t = o.target;
        if (!t || t.dead || G.spears <= 0) { u.order = null; u.state = 'return'; return false; }
        const d = A.dist(u, t);
        u.thought = `Несёт громовое копьё к: ${t.def.name}`;
        if (d > 80) { moveUnit(u, t.x - 40, t.y + 10, dt, 1.15); u.z = A.lerp(u.z, 8, dt * 2); return true; }
        G.spears--;
        const tx = t.x, ty = t.y, tz = t.def.h * 0.8;
        G.projs.push({
          kind: 'spear', x0: u.x, y0: u.y, z0: u.z + 4, x1: tx, y1: ty, z1: tz, t: 0, dur: 0.35, arc: 4,
          onHit: () => {
            A.explosion(t.x, t.y, tz);
            G.shake = Math.max(G.shake, 0.5);
            if (t.dead) return;
            t.spearHits++;
            A.damageTitan(t, 260 + t.maxHp * 0.16, u, { pierce: true });
            if (t.armor > 0) {
              t.armor = Math.max(0, t.armor - 0.42);
              A.float(t.x, t.y - t.def.h - 10, t.armor > 0 ? 'Броня треснула!' : 'Броня разбита!', '#ffb36a', true);
            }
            t.stunT = Math.max(t.stunT, 1.2);
          },
        });
        A.float(u.x, u.y - 12, 'Копьё!', '#ffb36a');
        u.order = null; u.state = 'return';
        return true;
      }
      case 'flank': {
        const t = o.target;
        if (!t || t.dead) { u.order = null; u.state = 'return'; return false; }
        if (o.i < o.wp.length) {
          const p = o.wp[o.i];
          u.thought = 'Обходит Звероподобного с фланга через лес';
          u.z = A.lerp(u.z, 10, dt * 2);
          if (moveUnit(u, p.x, p.y, dt, 1.3)) o.i++;
          return true;
        }
        u.target = t; u.state = 'engage';
        engage(u, dt);
        return true;
      }
      case 'charge': {
        const t = o.target;
        if (!t || t.dead || t.retreating) { u.order = null; u.state = 'return'; return false; }
        const d = A.dist(u, t);
        u.thought = 'Кавалерийская атака на Звероподобного!';
        u.z = 0;
        if (!o.landed && (d < 170 || G.t > o.landT)) {
          o.landed = true;
          if (!G.dir.chargeLanded || G.t - G.dir.chargeLanded > 5) {
            G.dir.chargeLanded = G.t;
            t.distractT = Math.max(t.distractT, 14);
            A.flare(u.x, u.y, '#5ad16a');
            A.log('Эрвин Смит', 'Кавалерия дошла! Сигнальные ракеты ослепили Звероподобного — броски сорваны на 14 сек.', 'order');
          }
          if (u.card.ability === 'commander' && A.chance(0.3)) {
            A.killUnit(u, 'погиб, ведя кавалерию в атаку. «Солдаты, вперёд!»');
            return true;
          }
          u.order = { kind: 'focus', target: t, exp: G.t + 10, bonus: 1.1 };
          return true;
        }
        if (!o.landed) { moveUnit(u, t.x - 20, t.y, dt, 1.15); return true; }
        return false;
      }
      case 'focus': {
        const t = o.target;
        if (!t || t.dead) { u.order = null; u.state = 'return'; return false; }
        if (u.card.kind === 'hero' && u.hp <= 1 && u.card.ability !== 'spin') { u.order = null; return false; }
        u.target = t; u.state = 'engage';
        engage(u, dt);
        return true;
      }
      case 'fallback': {
        u.thought = o.why || 'Отходит по приказу';
        u.target = null;
        if (moveUnit(u, o.x, o.y, dt, 1.1)) { u.z = A.lerp(u.z, 0, dt * 3); }
        // самооборона
        const t = G.titans.find((tt) => !tt.dead && A.dist(tt, u) < tt.def.w * 0.5 + 10 && !(tt.def.steam && tt.steamOn));
        if (t && u.atkT <= 0 && u.gas > 10) { u.target = t; engage(u, dt); }
        return true;
      }
    }
    return false;
  };

  // ---------- Мозг командующего ----------
  function say(text, erwin, col) {
    A.log('Эрвин Смит', text, 'order');
    if (erwin) { A.flare(erwin.x, erwin.y, col || '#5ad16a'); A.float(erwin.x, erwin.y - 16, 'Приказ!', '#9fffb0'); }
  }

  function spearCandidates(exclude) {
    return G.units.filter((u) => alive(u) && !u.order && !u.onWall && !u.card.cannon && u.card.faction === 'survey'
      && !['levi', 'pyxis', 'eren', 'erwin', 'armin'].includes(u.card.id)
      && u.gas > 25 && (u.card.kind === 'squad' || u.hp > 1) && u !== exclude && u.state !== 'refill');
  }
  function nearestOf(list, t) {
    let b = null, bd = 1e9;
    for (const u of list) { const d = A.dist(u, t); if (d < bd) { bd = d; b = u; } }
    return bd < 1500 ? b : null;
  }

  function allocateSpears(erwin, liveT) {
    const D = G.dir;
    if (G.spears <= 0) return;
    const pending = G.units.filter((u) => alive(u) && u.order && u.order.kind === 'spear').length;
    let free = G.spears - pending;
    if (free <= 0) return;
    const futureHeavy = G.queue.some((q) => q.type === 'armored' || q.type === 'colossal')
      || liveT.some((t) => (t.type === 'armored' && t.armor > 0) || t.type === 'colossal');
    const reserve = futureHeavy ? 2 : 0;
    const ordersOn = (t) => G.units.filter((u) => alive(u) && u.order && u.order.kind === 'spear' && u.order.target === t).length;
    const cands = [];
    for (const t of liveT) {
      if (SDE(t) > 700) continue;
      if (t.type === 'armored' && t.armor > 0) cands.push({ t, prio: 100 + (t.charging ? 60 : 0) + (t.atWall ? 40 : 0), need: t.armor > 0.45 ? 2 : 1, why: 'armored' });
      else if (t.type === 'colossal' && !t.steamOn && SDE(t) < 450) cands.push({ t, prio: 85, need: 2, why: 'colossal' });
      else if (t.type === 'female' && t.crystalT > 0 && G.t > (t.spearOkT || 0)) cands.push({ t, prio: 80, need: 1, why: 'crystal', cd: 4 });
      else if (t.type === 'female' && (t.hardenT > 0 || t.rootT > 0) && free > reserve + 1 && G.t > (t.spearOkT || 0)) cands.push({ t, prio: 60, need: 1, why: 'female', cd: 9 });
      else if (t.type === 'jaw' && free > reserve + 2 && SDE(t) < 350 && G.t > (t.spearOkT || 0)) cands.push({ t, prio: 40, need: 1, why: 'jaw', cd: 12 });
    }
    cands.sort((a, b) => b.prio - a.prio);
    for (const c of cands) {
      while (ordersOn(c.t) < c.need && free > 0) {
        const pool = spearCandidates();
        let u = nearestOf(pool, c.t);
        if (!u && !erwin.order && erwin.hp > 1) u = erwin;
        if (!u) return;
        u.order = { kind: 'spear', target: c.t, exp: G.t + 18 };
        free--;
        if (c.cd) { c.t.spearOkT = G.t + c.cd; c.need = 0; }
        const left = G.spears - 1;
        const reasons = {
          armored: `«${c.t.def.name} ${c.t.charging ? 'разгоняется на ворота' : 'идёт к стене'}. Лезвия его не возьмут — ${u === erwin ? 'беру копьё сам' : u.card.name + ', громовое копьё в сочленения'}!»`,
          colossal: `«Пар иссяк — ${u === erwin ? 'бью копьём сам' : u.card.name + ', копьё в загривок Колоссальному'}, пока он беззащитен!»`,
          crystal: `«Она прячется в кристалле и лечится! ${u === erwin ? 'Бью копьём сам' : u.card.name + ', громовое копьё в кристалл'} — расколоть, пока не вылечилась!»`,
          female: `«Она отвердела/скована — ${u.card.name}, копьём по защите, чтобы клинки дошли до загривка!»`,
          jaw: `«Челюстной охотится на наших — копьё ему, запас позволяет.»`,
        };
        say(reasons[c.why] + ` (копий: ${left}${reserve ? `, ещё ${reserve} держу в резерве` : ''})`, erwin, '#ffb36a');
      }
    }
    // показать, что он НЕ тратит копья впустую
    const crowd = liveT.filter((t) => !t.def.special && SDE(t) < 300).length;
    if (crowd >= 5 && !cands.length && G.spears > 0 && (D.cd.save || 0) <= 0) {
      D.cd.save = 70;
      say(`«Копья по обычным титанам не тратим — их ${G.spears}, и каждое понадобится против брони. С мелочью справятся клинки и пушки.»`, null);
    }
  }

  function beastPlan(erwin, liveT) {
    const D = G.dir;
    const beast = liveT.find((t) => t.type === 'beast' && !t.retreating);
    if (!beast || (D.cd.beast || 0) > 0) return;
    const atHold = SDE(beast) <= beast.def.holdSd + 40;
    if (!atHold || beast.disarmT > 0 || beast.distractT > 0) return;
    const recent = G.rockHits.reduce((s, r) => s + r.n, 0);
    const exposed = G.units.filter((u) => alive(u) && A.dist(u, beast) < beast.def.throwRange && SDE(u) > -60).length;
    if (recent < 2 && exposed < 3) return;
    D.cd.beast = 30;

    const levi = G.units.find((u) => alive(u) && isId(u, 'levi'));
    const cavalry = G.units.filter((u) => alive(u) && u.card.kind === 'squad' && u.card.faction === 'survey' && !u.order);
    const soldiers = cavalry.reduce((s, u) => s + u.members, 0);
    // обход: вдоль стены в сторону, потом заход сбоку-сзади
    const bn = A.roseNormal(beast.x, beast.y), tx = -bn.y, ty = bn.x;
    const side = A.chance(0.5) ? 1 : -1;
    const fx = beast.x + tx * side * 330 - bn.x * 160, fy = beast.y + ty * side * 330 - bn.y * 160;
    const wp = [{ x: fx, y: fy }, { x: beast.x + tx * side * 70 + bn.x * 60, y: beast.y + ty * side * 70 + bn.y * 60 }];

    const sendCharge = (exp, note) => {
      const chargers = cavalry.slice();
      if (erwin && !erwin.order && note) chargers.push(erwin);
      chargers.forEach((u) => { u.order = { kind: 'charge', target: beast, landT: G.t + exp, exp: G.t + exp + 15 }; u.target = null; });
      return chargers.length;
    };

    if (levi) {
      levi.order = { kind: 'flank', target: beast, wp, i: 0, exp: G.t + 60 };
      levi.target = null;
      if (soldiers >= 4) {
        sendCharge(9, false);
        say(`«Звероподобный бьёт по нам камнями (потерь: ${recent}). Отряды — ложная атака в лоб, отвлеките его. Леви — в обход с фланга, руби руки!»`, erwin);
      } else {
        say(`«Звероподобный обстреливает поле. Леви, обходи его с фланга — он не успеет развернуться к тебе!»`, erwin);
      }
      return;
    }
    if (G.hand.levi > 0) {
      const res = A.deploy('levi', fx, fy, true);
      if (res.ok) {
        res.unit.order = { kind: 'flank', target: beast, wp, i: 0, exp: G.t + 70 };
        say('«Леви — из резерва в бой. Только он доберётся до Звероподобного живым. Обходи с фланга!»', erwin);
        return;
      }
    }
    if (soldiers >= 6 && G.unrest < 65) {
      const n = sendCharge(14, true);
      say(`«Иначе его не достать. Все ${n} звеньев и я — самоубийственная кавалерийская атака! Мы — приманка. Сигнальные ракеты в лицо, сорвём его броски!» (часть бойцов погибнет)`, erwin, '#ff6b5a');
      return;
    }
    // отход за стену
    let moved = 0;
    for (const u of G.units) {
      if (!alive(u) || u.onWall || SDE(u) < 0 || u.card.ability === 'shifter') continue;
      if (A.dist(u, beast) > beast.def.throwRange) continue;
      const ip = A.wallPoint(u.x, u.y, -HALF() - 70);
      u.order = { kind: 'fallback', x: ip.x, y: ip.y, exp: G.t + 22, why: 'Укрывается от камнепада за стеной' };
      moved++;
    }
    if (moved) say(soldiers >= 6
      ? `«Город и так на грани бунта — ещё одна кавалерийская атака, и нас сметут собственные горожане. Все ${moved} звеньев — за стену! Пусть работают пушки.»`
      : `«Людей для атаки мало — не будем отдавать их камням. Все ${moved} звеньев — за стену! Пусть работают пушки.»`, erwin);
  }

  function colossalPlan(erwin, liveT) {
    const D = G.dir;
    const col = liveT.find((t) => t.type === 'colossal');
    if (!col || SDE(col) > 450) return;
    if (col.steamOn && (D.cd.colSteam || 0) <= 0) {
      const near = G.units.filter((u) => alive(u) && A.reachable(u) && A.dist(u, col) < 250 && u.card.ability !== 'shifter');
      if (near.length) {
        D.cd.colSteam = 14;
        near.forEach((u) => {
          const dx = u.x - col.x, dy = u.y - col.y, d = Math.hypot(dx, dy) || 1;
          let fx = col.x + dx / d * 270, fy = col.y + dy / d * 270;
          if (A.sdRose(fx, fy) < HALF() + 20) { const p = A.wallPoint(fx, fy, HALF() + 25); fx = p.x; fy = p.y; }
          u.order = { kind: 'fallback', x: fx, y: fy, exp: G.t + Math.max(3, col.steamT), why: 'Ждёт, пока иссякнет пар' };
        });
        say(`«Раскалённый пар! ${near.length} звеньев — отойти от Колоссального на сотню метров. Ждём: он сжигает сам себя.»`, erwin);
      }
    }
    if (!col.steamOn && (D.cd.colStrike || 0) <= 0) {
      const strikers = G.units.filter((u) => alive(u) && A.reachable(u) && !u.card.cannon && u.card.ability !== 'analyst' && u.card.ability !== 'shifter'
        && A.dist(u, col) < 650 && (!u.order || u.order.kind === 'fallback'));
      if (strikers.length) {
        D.cd.colStrike = 7;
        strikers.forEach((u) => { u.order = { kind: 'focus', target: col, bonus: 1.3, exp: G.t + Math.min(6, col.steamT) }; });
        say(`«Пар иссяк — все ${strikers.length} звеньев на загривок Колоссального! У нас считанные секунды.»`, erwin);
      }
    }
  }

  function femalePlan(erwin, liveT) {
    const D = G.dir;
    const fem = liveT.find((t) => t.type === 'female');
    if (!fem || (D.cd.trap || 0) > 0 || SDE(fem) > 600) return;
    const squads = G.units.filter((u) => alive(u) && A.reachable(u) && u.card.kind === 'squad' && A.dist(u, fem) < 360);
    if (squads.length < 2) return;
    D.cd.trap = 32;
    fem.rootT = 7;
    const heroes = G.units.filter((u) => alive(u) && A.reachable(u) && ['levi', 'mikasa', 'jean', 'connie', 'hange'].includes(u.card.id) && A.dist(u, fem) < 600 && !u.order);
    heroes.forEach((u) => { u.order = { kind: 'focus', target: fem, bonus: 1.2, exp: G.t + 7 }; });
    say(`«Ловушка! ${squads.length} отряда опутали Женскую особь тросами — она скована на 7 сек.` + (heroes.length ? ` ${heroes.map((h) => h.card.name.split(' ')[0]).join(', ')} — бейте одновременно, она не успеет отвердеть везде.»` : ' Держите её!»'), erwin);
  }

  function swarmPlan(erwin, liveT) {
    const D = G.dir;
    if ((D.cd.swarm || 0) > 0) return;
    const near = liveT.filter((t) => SDE(t) < 280 && !t.def.special).length;
    if (near < 7) return;
    D.cd.swarm = 25;
    let moved = 0;
    for (const u of G.units) {
      if (!alive(u) || !A.reachable(u) || u.card.kind !== 'squad' || u.order) continue;
      if (A.anchorAt(u.x, u.y) > 0.8) continue;
      const op = A.wallPoint(u.x, u.y, HALF() + 55);
      u.order = { kind: 'fallback', x: op.x, y: op.y, exp: G.t + 16, why: 'Перестраивается к стене — там есть опоры' };
      moved++;
    }
    G.units.forEach((u) => { if (alive(u) && u.onWall && u.card.cannon) u.atkT = Math.min(u.atkT, A.rand(0, 0.4)); });
    say(`«У ворот ${near} титанов. ` + (moved ? `${moved} звеньев из открытого поля — к подножию стены, там тросам есть за что цепляться. ` : '') + 'Пушки — беглый огонь!»', erwin);
  }

  function wallPlan(erwin) {
    const D = G.dir;
    if (G.sealed || G.wallHp > G.wallMax * 0.35 || (D.cd.seal || 0) > 0) return;
    const eren = G.units.find((u) => alive(u) && isId(u, 'eren'));
    if (eren && eren.form === 'titan' && !(eren.order && eren.order.kind === 'seal')) {
      eren.order = { kind: 'seal', step: 0 }; D.cd.seal = 999;
      say('«Эрен — валун в пролом! Все остальные — прикрывать его любой ценой!»', erwin);
    } else if (!eren && G.hand.eren > 0) {
      const Dd = A.DISTRICTS[G.lastHit != null ? G.lastHit : 0];
      const res = A.deploy('eren', Dd.gx + Dd.nx * 70 + Dd.ny * 30, Dd.gy + Dd.ny * 70 + Dd.nx * 30, true);
      if (res.ok) { res.unit.pendingSeal = true; D.cd.seal = 999; say('«Стена на пределе. Вводим Эрена: превращение у ворот — и сразу за валуном!»', erwin); }
    }
  }

  function escortPlan() {
    const eren = G.units.find((u) => alive(u) && isId(u, 'eren') && ((u.order && u.order.kind === 'seal') || u.form === 'human'));
    if (!eren || eren.state === 'safe' || SDE(eren) < -HALF()) return;
    const threat = G.titans.filter((t) => !t.dead && A.dist(t, eren) < 140).sort((a, b) => A.dist(a, eren) - A.dist(b, eren))[0];
    if (!threat) return;
    const guard = G.units.find((u) => alive(u) && ['mikasa', 'levi', 'jean', 'connie'].includes(u.card.id) && !u.order && A.dist(u, threat) < 700);
    if (guard) {
      guard.order = { kind: 'focus', target: threat, exp: G.t + 5, bonus: 1.1 };
      guard.thought = 'Прикрывает Эрена';
    }
  }

  function interceptPlan(erwin, liveT) {
    const D = G.dir;
    if ((D.cd.intercept || 0) > 0) return;
    for (const t of liveT) {
      if (!t.def.erratic && t.type !== 'jaw') continue;
      const victim = G.units.find((u) => alive(u) && A.reachable(u) && A.dist(u, t) < 150
        && ((u.card.kind === 'hero' && u.hp <= 1) || u.card.ability === 'analyst' || u.card.ability === 'scientist' || (u.card.kind === 'squad' && u.members <= 2)));
      if (!victim) continue;
      const guard = G.units.filter((u) => alive(u) && A.reachable(u) && ['mikasa', 'levi', 'connie', 'jean', 'sasha'].includes(u.card.id) && !u.order && u !== victim && A.dist(u, t) < 650)
        .sort((a, b) => A.dist(a, t) - A.dist(b, t))[0];
      if (!guard) continue;
      guard.order = { kind: 'focus', target: t, exp: G.t + 6, bonus: 1.15 };
      D.cd.intercept = 16;
      say(`«${t.def.name} кинулся на ${victim.card.name.split(' ')[0] === 'Отряд' ? 'ослабленный отряд' : victim.card.name.split(' ')[0]}. ${guard.card.name.split(' ')[0]} — перехватить!»`, erwin);
      return;
    }
  }

  // ---------- Переброска войск между районами ----------
  function postNear(D, i, onWall) {
    if (onWall) { const a = D.ang + (i % 2 ? 1 : -1) * (0.3 + 0.28 * Math.floor(i / 2) % 1.4); return { x: D.cx + Math.cos(a) * D.r, y: D.cy + Math.sin(a) * D.r }; }
    const a = D.ang + A.rand(-0.75, 0.75), rr = D.r + A.rand(80, 230);
    return { x: D.cx + Math.cos(a) * rr, y: D.cy + Math.sin(a) * rr };
  }
  const nearD = (u, D) => A.distXY(u.post.x, u.post.y, D.gx, D.gy) < 650;
  // перебросить бойцов (кроме Эрена) к районам из списка; keep — тех, кто уже там, не трогать
  A.moveArmyTo = function (idxs, onlyFrom) {
    const targets = idxs.map((i) => A.DISTRICTS[i]);
    const moved = {};
    let k = 0;
    for (const u of G.units) {
      if (!alive(u) || u.card.ability === 'shifter') continue;
      if (targets.some((D) => nearD(u, D))) continue;
      if (onlyFrom && !onlyFrom(u)) continue;
      const D = targets[k % targets.length];
      const p = postNear(D, k++, u.onWall || !!u.card.wallOnly);
      if (A.relocate(u, p.x, p.y).ok) moved[D.name] = (moved[D.name] || 0) + 1;
    }
    return moved;
  };
  // Эрвин сам перебрасывает силы: заранее по данным разведки и срочно, если район остался голым
  A.erwinRedeploy = function (dirs, early) {
    const erwin = G.auras.erwin;
    if (!erwin || erwin.dead) return;
    const targets = dirs.map((i) => A.DISTRICTS[i]);
    const bare = targets.filter((D) => G.units.filter((u) => alive(u) && nearD(u, D)).length < 2);
    if (!bare.length) return;
    const moved = A.moveArmyTo(dirs);
    const list = Object.entries(moved).map(([n, c]) => `${c} → ${n}`).join(', ');
    if (!list) return;
    if (early) say(`«Разведка докладывает: следующий удар — по району ${targets.map((D) => D.name).join(' и ')}. Перебрасываю силы заранее через тыл: ${list}.»`, erwin);
    else say(`«${bare.map((D) => D.name).join(' и ')} без защиты! Марш-бросок вдоль стены: ${list}.»`, erwin, '#ff6b5a');
  };

  A.director = function (dt) {
    const D = G.dir;
    D.tick = (D.tick || 0) - dt;
    if (D.tick > 0) return;
    D.tick = 0.5;
    for (const k in D.cd) D.cd[k] -= 0.5;
    escortPlan();
    const erwin = G.auras.erwin;
    if (!erwin || G.phase !== 'wave') return;
    const liveT = G.titans.filter((t) => !t.dead);
    if (!liveT.length) return;
    if ((D.cd.redeploy || 0) <= 0 && G.queue && G.queue.dirs) { D.cd.redeploy = 20; A.erwinRedeploy(G.queue.dirs, false); }
    wallPlan(erwin);
    beastPlan(erwin, liveT);
    colossalPlan(erwin, liveT);
    femalePlan(erwin, liveT);
    allocateSpears(erwin, liveT);
    swarmPlan(erwin, liveT);
    interceptPlan(erwin, liveT);
    if (!erwin.order) erwin.thought = 'Оценивает поле боя';
  };
})(window.AOT);
