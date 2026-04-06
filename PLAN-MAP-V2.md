# План: Продвинутая карта СТО v2

## Решения
- **Размещение:** Новая страница `/map-view`, старая `/map` остаётся
- **Данные постов:** Как сейчас + расширить (загрузка, история, камера) + модальное окно как на текущей карте
- **Хранение layout:** API бэкенда (Prisma + REST)

---

## Шаг 1: Backend — модель MapLayout + REST API

**Prisma модель:**
```
model MapLayout {
  id        String   @id @default(uuid())
  name      String   // "СТО Колесникова-38"
  width     Float    // ширина в мм (46540)
  height    Float    // высота в мм (30690)
  bgImage   String?  // путь к фоновому изображению (/data/sto-plan.png)
  elements  String   // JSON массив элементов [{id, type, name, x, y, w, h, rotation, color, data}]
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Эндпоинты:**
- `GET /api/map-layout` — получить активный layout
- `GET /api/map-layout/:id` — получить конкретный layout
- `POST /api/map-layout` — создать layout (manage_zones)
- `PUT /api/map-layout/:id` — обновить layout (manage_zones)
- `DELETE /api/map-layout/:id` — удалить layout (manage_zones)

**Файлы:** новый роут `backend/src/routes/mapLayout.js`, миграция Prisma

---

## Шаг 2: Обновить MapEditor — сохранение через API

Текущий редактор сохраняет в localStorage. Переделаю:
- Кнопка "Сохранить" → `PUT /api/map-layout/:id`
- Кнопка "Загрузить" → `GET /api/map-layout`
- Убрать localStorage для layout (оставить только для черновиков)
- Добавить поле "Имя карты" в toolbar
- Добавить загрузку фонового изображения (сохраняется как путь к файлу в /data/)

**Файлы:** `frontend/src/pages/MapEditor.jsx`

---

## Шаг 3: Создать MapViewer — пользовательская страница

Новая страница `/map-view` — интерактивная карта с real-time данными.

**Архитектура:**
1. Загрузка layout из `GET /api/map-layout` (активный)
2. Загрузка real-time данных из `GET /api/zones` (посты со статусами) + `GET /api/dashboard-posts` (ЗН, авто, работники)
3. Рендер через react-konva: фоновое изображение + элементы из layout
4. Элементы типа "post" связываются с реальными данными по имени (Пост 1 → post number 1)
5. Polling каждые 5 сек для обновления статусов

**UI элементы на карте:**
- **Посты** — прямоугольники с цветом статуса (free/occupied/active_work/idle), показывают: номер, статус, номер авто, ЗН
- **Зоны** — полупрозрачные области с названием и count автомобилей
- **Камеры** — красные кружки с углом обзора, клик → стрим модалка
- **Двери** — визуальные линии
- **Стены** — визуальные блоки

**Клик на пост → модальное окно** (как на текущей карте MapView):
- Название поста + статус badge
- Автомобиль (номер, марка, модель)
- Заказ-наряд (номер, тип работ)
- Работник
- Время (начало → прогноз окончания)
- Загрузка поста за день (%)
- Кнопка "Перейти к посту" → PostsDetail

**Клик на камеру → CameraStreamModal** (уже есть)

**Верхняя панель:**
- Статистика: всего постов, занято, свободно, в работе, простой
- Автомобилей на СТО
- Загрузка СТО (%)

**Файлы:** новый `frontend/src/pages/MapViewer.jsx` (~350 LOC)

---

## Шаг 4: Интеграция в приложение

- Добавить route `/map-view` в App.jsx (lazy load)
- Добавить пункт "Карта СТО v2" в Sidebar (иконка MapPin)
- Добавить pageId `map-view` в permissions
- Добавить i18n ключи (ru + en)
- Старая карта `/map` остаётся как есть

---

## Порядок выполнения
1. Backend: Prisma миграция + REST API (~30 мин)
2. MapEditor: переключить на API (~20 мин)
3. MapViewer: новая страница (~60 мин)
4. Интеграция: роуты, sidebar, i18n (~10 мин)
5. Билд, тест, коммит
