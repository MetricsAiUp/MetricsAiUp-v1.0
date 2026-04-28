// Маппинг русских названий из БД на английские
const ZONE_NAMES = {
  'Зона Въезд/Выезд': 'Entry/Exit Zone',
  'Зона Ожидания / Парковка': 'Waiting / Parking Zone',
  'Ремонтная зона (посты 1-4)': 'Repair Zone (posts 1-4)',
  'Ремонтная зона (посты 5-8)': 'Repair Zone (posts 5-8)',
  'Диагностика (посты 9-10)': 'Diagnostics (posts 9-10)',
};

const POST_NAMES = {
  'Пост 1': 'Post 1',
  'Пост 2': 'Post 2',
  'Пост 3': 'Post 3',
  'Пост 4': 'Post 4',
  'Пост 5': 'Post 5',
  'Пост 6': 'Post 6',
  'Пост 7': 'Post 7',
  'Пост 8': 'Post 8',
  'Пост 9': 'Post 9',
  'Пост 10': 'Post 10',
};

export function translateZone(name, isRu) {
  if (isRu || !name) return name;
  return ZONE_NAMES[name] || name.replace('Зона', 'Zone').replace('Ремонтная зона', 'Repair Zone')
    .replace('Диагностика', 'Diagnostics').replace('Ожидания', 'Waiting')
    .replace('Парковка', 'Parking').replace('посты', 'posts');
}

export function translatePost(nameOrPost, isRu) {
  // Принимает строку (legacy) или объект { name, displayName, displayNameEn }
  if (nameOrPost && typeof nameOrPost === 'object') {
    const ru = nameOrPost.displayName || nameOrPost.name;
    const en = nameOrPost.displayNameEn || nameOrPost.displayName || nameOrPost.name;
    const picked = isRu ? ru : en;
    if (!picked) return picked;
    if (isRu) return picked;
    return POST_NAMES[picked] || picked.replace('Пост', 'Post');
  }
  const name = nameOrPost;
  if (isRu || !name) return name;
  return POST_NAMES[name] || name.replace('Пост', 'Post');
}

// --- Live monitoring data translation (EN → RU) ---

const WORKS_PHRASES = [
  [/\bin progress\b/gi, 'в процессе'],
  [/\bwork(s)? (is |are )?underway\b/gi, 'работы ведутся'],
  [/\bengine compartment\b/gi, 'моторный отсек'],
  [/\bengine bay\b/gi, 'моторный отсек'],
  [/\bengine components?\b/gi, 'компоненты двигателя'],
  [/\bengine hoist\b/gi, 'подъёмник двигателя'],
  [/\bservice (bay|station|area|center|work)\b/gi, 'сервисная зона'],
  [/\bservice cart\b/gi, 'сервисная тележка'],
  [/\brepair work\b/gi, 'ремонтные работы'],
  [/\bmaintenance work\b/gi, 'ТО'],
  [/\binspection work\b/gi, 'осмотр'],
  [/\bdiagnostic (work|inspection|equipment)\b/gi, 'диагностика'],
  [/\bhydraulic lift\b/gi, 'гидроподъёмник'],
  [/\bopen hood(s)?\b/gi, 'открытый капот'],
  [/\bhood(s)? (is |are )?open\b/gi, 'капот открыт'],
  [/\bdoor(s)? (is |are )?open\b/gi, 'двери открыты'],
  [/\bfront bumper\b/gi, 'передний бампер'],
  [/\brear hatch\b/gi, 'задняя дверь'],
  [/\bdriver.side door\b/gi, 'водительская дверь'],
  [/\bpassenger.side door\b/gi, 'пассажирская дверь'],
  [/\bbody panels?\b/gi, 'кузовные панели'],
  [/\bwheel(s)? (are |is )?(removed|off|missing)\b/gi, 'колёса сняты'],
  [/\btire (change|replacement|service)\b/gi, 'замена шин'],
  [/\balignment work\b/gi, 'развал-схождение'],
  [/\bglass\/window treatment\b/gi, 'обработка стёкол'],
  [/\bfilm application\b/gi, 'нанесение плёнки'],
  [/\bon the floor\b/gi, 'на полу'],
];

const WORKS_WORDS = [
  [/\bvehicle(s)?\b/gi, 'автомобиль'],
  [/\belevated\b/gi, 'поднят'],
  [/\bpositioned\b/gi, 'установлен'],
  [/\blift(ed)?\b/gi, 'подъёмник'],
  [/\bhoist\b/gi, 'подъёмник'],
  [/\bhood(s)?\b/gi, 'капот'],
  [/\btrunk\b/gi, 'багажник'],
  [/\bdoor(s)?\b/gi, 'двери'],
  [/\btailgate\b/gi, 'задняя дверь'],
  [/\bbumper(s)?\b/gi, 'бампер'],
  [/\bwheel(s)?\b/gi, 'колёса'],
  [/\btire(s)?\b/gi, 'шины'],
  [/\bengine\b/gi, 'двигатель'],
  [/\btransmission\b/gi, 'трансмиссия'],
  [/\bchassis\b/gi, 'шасси'],
  [/\bsuspension\b/gi, 'подвеска'],
  [/\bbrake(s)?\b/gi, 'тормоза'],
  [/\bexhaust\b/gi, 'выхлоп'],
  [/\bmaintenance\b/gi, 'ТО'],
  [/\binspection\b/gi, 'осмотр'],
  [/\bdiagnostic(s)?\b/gi, 'диагностика'],
  [/\brepair(s|ed)?\b/gi, 'ремонт'],
  [/\bservice\b/gi, 'обслуживание'],
  [/\bdisassembl(y|ed)\b/gi, 'разборка'],
  [/\bdismantl(ed|ing)\b/gi, 'демонтаж'],
  [/\bremov(ed|al)\b/gi, 'снято'],
  [/\bscattered\b/gi, 'разложены'],
  [/\bexposed\b/gi, 'открыт'],
  [/\baccessible\b/gi, 'доступен'],
  [/\bundergoing\b/gi, 'проходит'],
  [/\bindicating\b/gi, 'указывает на'],
  [/\bactive\b/gi, 'активные'],
  [/\bmajor\b/gi, 'капитальный'],
  [/\bmultiple\b/gi, 'несколько'],
  [/\bvisible\b/gi, 'видны'],
  [/\bopen\b/gi, 'открыт'],
  [/\bboth\b/gi, 'оба'],
  [/\bapplied\b/gi, 'нанесено'],
  [/\bparts?\b/gi, 'детали'],
  [/\btools?\b/gi, 'инструменты'],
  [/\bequipment\b/gi, 'оборудование'],
  [/\bcomponents?\b/gi, 'компоненты'],
  [/\bsuggesting\b/gi, 'что указывает на'],
  [/\bappears?\b/gi, ''],
  [/\blikely\b/gi, 'вероятно'],
  [/\bthe\b/gi, ''],
  [/\bis\b/gi, ''],
  [/\bare\b/gi, ''],
  [/\ba\b/gi, ''],
  [/\ban\b/gi, ''],
  [/\bhas\b/gi, ''],
  [/\bhave\b/gi, ''],
  [/\bbeen\b/gi, ''],
  [/\bfor\b/gi, 'для'],
  [/\bor\b/gi, 'или'],
  [/\band\b/gi, 'и'],
  [/\bwith\b/gi, 'с'],
  [/\bon\b/gi, 'на'],
  [/\bat\b/gi, 'на'],
  [/\bin\b/gi, 'в'],
  [/\bto\b/gi, ''],
  [/\bbe\b/gi, ''],
  [/\bof\b/gi, ''],
  [/\bits\b/gi, 'его'],
];

export function translateWorksDesc(text, isRu) {
  if (!text || !isRu) return text;
  if (/^[А-Яа-яЁё]/.test(text)) return text;
  let s = text;
  for (const [re, ru] of WORKS_PHRASES) s = s.replace(re, ru);
  for (const [re, ru] of WORKS_WORDS) s = s.replace(re, ru);
  s = s.replace(/\s{2,}/g, ' ').trim().replace(/^[.,;:\s]+/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
