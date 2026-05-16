-- AlterTable: добавляем поля для сводного отчёта /utilization
--   work_start/work_end/work_days  — окно работы СТО (для ШBF зон)
--   hourly_rate/currency           — единая ставка СТО для финблока
--   error_margin_pct/_note         — ручная погрешность отчёта
ALTER TABLE "locations" ADD COLUMN "work_start" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "locations" ADD COLUMN "work_end" TEXT NOT NULL DEFAULT '20:00';
ALTER TABLE "locations" ADD COLUMN "work_days" TEXT NOT NULL DEFAULT '1,2,3,4,5,6';
ALTER TABLE "locations" ADD COLUMN "hourly_rate" DECIMAL;
ALTER TABLE "locations" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB';
ALTER TABLE "locations" ADD COLUMN "error_margin_pct" REAL;
ALTER TABLE "locations" ADD COLUMN "error_margin_note" TEXT;
