-- Создание таблицы monitoring_snapshots (до этого создавалась через db push, без миграции).
CREATE TABLE IF NOT EXISTS "monitoring_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zone_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plate_number" TEXT,
    "car_color" TEXT,
    "car_model" TEXT,
    "car_make" TEXT,
    "car_body" TEXT,
    "works_in_progress" BOOLEAN NOT NULL DEFAULT false,
    "works_description" TEXT,
    "people_count" INTEGER NOT NULL DEFAULT 0,
    "confidence" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Расширение monitoring_snapshots дополнительными полями внешнего API.
ALTER TABLE "monitoring_snapshots" ADD COLUMN "external_type" TEXT;
ALTER TABLE "monitoring_snapshots" ADD COLUMN "car_first_seen" DATETIME;
ALTER TABLE "monitoring_snapshots" ADD COLUMN "open_parts" TEXT;
ALTER TABLE "monitoring_snapshots" ADD COLUMN "external_update" DATETIME;

-- Индексы для быстрых выборок по зоне/времени.
CREATE INDEX IF NOT EXISTS "monitoring_snapshots_zone_name_timestamp_idx" ON "monitoring_snapshots"("zone_name", "timestamp");
CREATE INDEX IF NOT EXISTS "monitoring_snapshots_timestamp_idx" ON "monitoring_snapshots"("timestamp");

-- Таблица текущего состояния (одна строка на zone_name, upsert pattern).
CREATE TABLE "monitoring_current" (
    "zone_name" TEXT NOT NULL PRIMARY KEY,
    "external_type" TEXT,
    "status" TEXT NOT NULL,
    "plate_number" TEXT,
    "car_color" TEXT,
    "car_model" TEXT,
    "car_make" TEXT,
    "car_body" TEXT,
    "car_first_seen" DATETIME,
    "works_in_progress" BOOLEAN NOT NULL DEFAULT false,
    "works_description" TEXT,
    "people_count" INTEGER NOT NULL DEFAULT 0,
    "open_parts" TEXT,
    "confidence" TEXT,
    "external_update" DATETIME,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
