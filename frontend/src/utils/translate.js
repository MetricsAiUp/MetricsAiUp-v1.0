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

export function translatePost(name, isRu) {
  if (isRu || !name) return name;
  return POST_NAMES[name] || name.replace('Пост', 'Post');
}
