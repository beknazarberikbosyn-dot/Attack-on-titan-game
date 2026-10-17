// Игровые данные: мир, титаны, карточки, волны
window.AOT = window.AOT || {};
(function (A) {
  'use strict';

  // 1 пиксель карты ≈ 0.5 м. Стена 50 м ≈ 100 px высотой (в виде сверху — полоса).
  // Остров Парадиз: 1 px карты ≈ 0.5 км по кольцам стен (масштаб условный)
  A.WORLD = { W: 4000, H: 3800, wallHp: 1000 };

  A.START_POINTS = 50;

  // Титаны. pts — баллы за убийство.
  A.TITANS = {
    small: {
      name: 'Малый титан', short: '3–7 м', hp: 60, speed: 20, h: 14, w: 7, sizeVar: [0.5, 1],
      wallDps: 1.2, reach: 8, atkCd: 2.2, acc: 0.42, pts: 2, aggro: 90, size: 0.6,
      hitDmg: 12, desc: 'Медленный и слабый, но опасен толпой.',
    },
    normal: {
      name: 'Титан', short: '10–15 м', hp: 130, speed: 15, h: 30, w: 12, sizeVar: [0.67, 1],
      wallDps: 2.5, reach: 13, atkCd: 2.4, acc: 0.5, pts: 3, aggro: 110, size: 1,
      hitDmg: 25, desc: 'Идёт на запах людей. Хватает тех, кто подлетел слишком близко.',
    },
    deviant: {
      name: 'Девиант', short: '8–14 м, аномальный', hp: 150, speed: 27, h: 28, w: 10, sizeVar: [0.6, 1],
      wallDps: 3, reach: 14, atkCd: 1.9, acc: 0.55, pts: 5, aggro: 160, size: 1,
      erratic: true, hitDmg: 28,
      desc: 'Непредсказуем: внезапные прыжки, игнорирует приманки, может кинуться на любого.',
    },
    jaw: {
      name: 'Челюстной титан', short: 'шифтер, 5 м', hp: 560, speed: 63, h: 11, w: 8,
      armor: 0.3, wallDps: 5, reach: 9, atkCd: 1.1, acc: 0.68, pts: 30, aggro: 600, size: 0.8,
      hunter: true, climber: true, special: true, hitDmg: 70,
      desc: 'Самый маленький и быстрый. Охотится на героев, взбирается по стене к расчётам пушек. Челюсти прокусывают что угодно.',
    },
    female: {
      name: 'Женская особь', short: 'шифтер, 14 м', hp: 980, speed: 38, h: 28, w: 11,
      wallDps: 6, reach: 16, atkCd: 1.4, acc: 0.62, pts: 40, aggro: 260, size: 1.2,
      harden: true, scream: true, crystal: true, special: true, hitDmg: 80,
      desc: 'Отвердевает загривок под ударом. На половине здоровья кричит и созывает титанов. Тяжело раненая — покрывается кристаллом и восстанавливается внутри; раскалывают его громовые копья.',
    },
    armored: {
      name: 'Бронированный титан', short: 'шифтер, 15 м', hp: 1150, speed: 22, charge: 62, h: 30, w: 14,
      armor: 0.85, wallDps: 6, wallHit: 0.09, reach: 15, atkCd: 1.8, acc: 0.5, pts: 60, aggro: 120,
      size: 1.25, special: true, hitDmg: 90,
      desc: 'Броня гасит 85% урона лезвий. Идёт тараном на стену — от удара расчёты наверху падают. Пробивается громовыми копьями.',
    },
    beast: {
      name: 'Звероподобный титан', short: 'шифтер, 17 м', hp: 1350, speed: 12, h: 34, w: 15,
      wallDps: 6, reach: 17, atkCd: 1.6, acc: 0.6, pts: 75, aggro: 140, size: 1.4,
      thrower: true, holdSd: 420, throwRange: 680, special: true, hitDmg: 90,
      desc: 'Держится далеко и бомбардирует солдат камнями. Его крик поднимает титанов прямо среди наших отрядов. Тяжело ранен — отступает.',
    },
    colossal: {
      name: 'Колоссальный титан', short: 'шифтер, 60 м', hp: 3300, speed: 7, h: 120, w: 44,
      wallDps: 9, wallHit: 0.38, reach: 40, atkCd: 3, acc: 0.4, pts: 100, aggro: 0, size: 4,
      steam: true, special: true, hitDmg: 400,
      desc: 'Выпускает облака раскалённого пара: всех рядом отбрасывает и обжигает, даже расчёты на стене. Пар сжигает его самого. Ударом сносит часть стены. Без пара загривок уязвим.',
    },
  };

  // Карточки. Уровни: I — отряды; II — персонажи без выдающейся силы; III — элита; IV — Леви.
  // img: картинку кладёшь сам в assets/cards/<id>.png (.jpg/.webp тоже подойдут)
  A.CARDS = [
    {
      id: 'garrison', name: 'Отряд гарнизона', tier: 1, cost: 10, kind: 'squad', faction: 'garrison',
      members: 5, dmg: 4, atkCd: 1.5, eva: 0.55, speed: 77, sense: 300, leash: 260, gasUse: 5,
      cannon: { dmg: 38, cd: 3.2, range: 380, aoe: 28 }, color: '#9b4a3a',
      role: 'Пушки на стене',
      desc: 'Поставь на стену — будут стрелять из пушек. В поле это слабая пехота.',
    },
    {
      id: 'scouts', name: 'Отряд разведкорпуса', tier: 1, cost: 20, kind: 'squad', faction: 'survey',
      members: 4, dmg: 10, atkCd: 1.15, eva: 0.8, speed: 112, sense: 360, leash: 340, gasUse: 4,
      color: '#4e6b3c', role: 'Манёвры на УПМ',
      desc: 'Режут загривки. В лесу и в городе сильнее, в открытом поле — слабее (не за что цеплять тросы).',
    },
    {
      id: 'armin', name: 'Армин Арлерт', tier: 2, cost: 30, kind: 'hero', faction: 'survey',
      hp: 2, dmg: 5, atkCd: 1.5, eva: 0.8, speed: 105, sense: 300, leash: 220, gasUse: 4,
      color: '#e2c55a', ability: 'analyst', role: 'Аналитик',
      desc: 'Почти не дерётся. Помечает титанов (+30% урона по ним), разгадывает повадки шифтеров, предупреждает о прыжках девиантов.',
    },
    {
      id: 'connie', name: 'Конни Спрингер', tier: 2, cost: 30, kind: 'hero', faction: 'survey',
      hp: 3, dmg: 14, atkCd: 1.0, eva: 0.9, speed: 140, sense: 380, leash: 360, gasUse: 4,
      color: '#9aa3ad', ability: 'decoy', role: 'Приманка',
      desc: 'Перетягивает на себя титанов, которые подбираются к раненым и слабым товарищам.',
    },
    {
      id: 'sasha', name: 'Саша Блауз', tier: 2, cost: 35, kind: 'hero', faction: 'survey',
      hp: 3, dmg: 9, atkCd: 0.9, eva: 0.88, speed: 119, sense: 420, leash: 380, gasUse: 2, range: 220,
      color: '#b5703a', ability: 'archer', role: 'Лучница',
      desc: 'Стреляет издалека в глаза: ослеплённый титан замирает. Приоритет — девианты и быстрые.',
    },
    {
      id: 'jean', name: 'Жан Кирштейн', tier: 2, cost: 40, kind: 'hero', faction: 'survey',
      hp: 3, dmg: 17, atkCd: 1.0, eva: 0.88, speed: 126, sense: 380, leash: 360, gasUse: 4,
      color: '#c7a27a', ability: 'leader', aura: 180, role: 'Командир звена',
      desc: 'Рядом с ним отряды бьют на 25% сильнее и реже гибнут. Уводит из боя почти разбитые отряды.',
    },
    {
      id: 'pyxis', name: 'Дот Пиксис', tier: 2, cost: 45, kind: 'hero', faction: 'garrison',
      hp: 2, dmg: 0, atkCd: 9, eva: 0.9, speed: 56, sense: 0, leash: 0, wallOnly: true,
      color: '#d8d0c0', ability: 'marshal', role: 'Командующий гарнизоном',
      desc: 'Только на стене. Пушки гарнизона заряжают быстрее и бьют сильнее, залп всеми орудиями по команде. Чинит стену между волнами.',
    },
    {
      id: 'hange', name: 'Ханджи Зоэ', tier: 2, cost: 55, kind: 'hero', faction: 'survey',
      hp: 3, dmg: 15, atkCd: 1.0, eva: 0.86, speed: 126, sense: 380, leash: 340, gasUse: 4,
      color: '#7b5a3c', ability: 'scientist', role: 'Учёный',
      desc: 'Берёт ослабленных титанов в плен (×1.5 баллов). Каждую волну собирает +1 громовое копьё.',
    },
    {
      id: 'mikasa', name: 'Микаса Аккерман', tier: 3, cost: 110, kind: 'hero', faction: 'survey',
      hp: 5, dmg: 55, atkCd: 0.75, eva: 0.95, speed: 175, sense: 520, leash: 520, gasUse: 3,
      color: '#b8333a', ability: 'guardian', role: 'Защитница',
      desc: 'Элитный боец. В первую очередь спасает тех, кого вот-вот схватят, и тех, кто у ворот.',
    },
    {
      id: 'eren', name: 'Эрен Йегер', tier: 3, cost: 130, kind: 'hero', faction: 'survey',
      hp: 1, titanHp: 1300, dmg: 55, atkCd: 1.1, eva: 0.3, speed: 48, sense: 420, leash: 420, stamina: 50,
      color: '#3d7a5a', ability: 'shifter', role: 'Титан-шифтер',
      desc: 'Превращается в титана и дерётся врукопашную. Если стена при смерти — затыкает пролом валуном. Потом истощён и беззащитен.',
    },
    {
      id: 'erwin', name: 'Эрвин Смит', tier: 3, cost: 140, kind: 'hero', faction: 'survey',
      hp: 3, dmg: 10, atkCd: 1.2, eva: 0.86, speed: 126, sense: 300, leash: 200, gasUse: 4,
      color: '#d9b74a', ability: 'commander', role: 'Главнокомандующий',
      desc: 'Командует всем полем: громовые копья — только туда, где они нужнее всего, манёвр Леви, кавалерийская атака, отход, ловушки.',
    },
    {
      id: 'levi', name: 'Леви Аккерман', tier: 4, cost: 200, kind: 'hero', faction: 'survey',
      hp: 6, dmg: 115, atkCd: 0.55, eva: 0.985, speed: 217, sense: 900, leash: 900, gasUse: 2,
      color: '#2b2f3a', ability: 'spin', role: 'Сильнейший солдат',
      desc: 'Вращательная атака режет нескольких титанов разом. Сам выбирает самую опасную цель.',
    },
  ];
  A.CARD = {};
  A.CARDS.forEach((c) => { A.CARD[c.id] = c; });

  A.TIER_NAMES = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
  A.TIER_COLORS = { 1: '#7a7f88', 2: '#4f8fbf', 3: '#c9a24a', 4: '#c0392b' };

  // Состав волны n
  A.buildWave = function (n) {
    const q = [];
    const add = (type, count, start, spread) => {
      for (let i = 0; i < count; i++) q.push({ type, t: start + Math.random() * spread });
    };
    const len = 30 + n * 2.5;
    add('small', 3 + Math.floor(n * 1.0), 0, len);
    add('normal', 3 + Math.floor(n * 1.4), 2, len);
    if (n >= 2) add('deviant', Math.floor(n * 0.6), 6, len);
    if (n === 4 || (n >= 9 && n % 3 === 0)) add('jaw', n > 14 ? 2 : 1, len * 0.4, 8);
    if (n === 5 || (n >= 6 && n % 4 === 1)) add('armored', 1, len * 0.5, 6);
    if (n === 7 || (n >= 8 && n % 5 === 2)) add('female', 1, len * 0.45, 6);
    if (n === 8 || (n >= 9 && n % 6 === 2)) add('beast', 1, 4, 4);
    if (n % 5 === 0 && n >= 10) add('colossal', 1, len * 0.6, 4);
    q.sort((a, b) => a.t - b.t);
    return q;
  };

  // Направления атаки: 0 Трост (юг), 1 Каранес (восток), 2 Ялкелл (север), 3 Кролва (запад)
  A.waveDirs = function (n) {
    if (n <= 3) return [0];
    const order = [1, 0, 3, 2];
    const p = order[(n - 4) % 4];
    const dirs = [p];
    if (n >= 9) dirs.push((p + 1 + (n % 3)) % 4);
    if (n >= 16) { const t = [0, 1, 2, 3].find((d) => !dirs.includes(d)); dirs.push(t); }
    return [...new Set(dirs)];
  };

  A.waveHpMul = (n) => 1 + (n - 1) * 0.1 + Math.max(0, n - 10) * 0.09;
  A.waveSpeedMul = (n) => Math.min(1.5, 1 + (n - 1) * 0.025);
})(window.AOT);
