-- AlterTable: добавляем occurred_at — время реального события
ALTER TABLE "discrepancies" ADD COLUMN "occurred_at" DATETIME;

-- CreateIndex
CREATE INDEX "discrepancies_status_severity_occurred_at_idx" ON "discrepancies" ("status", "severity", "occurred_at" DESC);
CREATE INDEX "discrepancies_occurred_at_idx" ON "discrepancies" ("occurred_at");

-- Backfill: вытаскиваем дату события из oneCValue / cvValue.
-- Источники по правилам:
--   no_show_in_cv             → oneCValue.scheduledStart
--   no_show_in_1c             → cvValue.startTime
--   wrong_post                → cvValue.startTime
--   time_mismatch             → oneCValue.closedAt либо cvValue.postStayEnd
-- Prisma SQLite хранит DateTime как INTEGER (миллисекунды Unix epoch),
-- поэтому ISO-строку из json_extract конвертируем через julianday.
-- Если ничего нет — оставляем NULL (фильтр откатывается на detected_at).
UPDATE "discrepancies"
SET "occurred_at" = CAST(
  (julianday(COALESCE(
    json_extract("one_c_value", '$.scheduledStart'),
    json_extract("cv_value", '$.startTime'),
    json_extract("one_c_value", '$.closedAt'),
    json_extract("cv_value", '$.postStayEnd')
  )) - 2440587.5) * 86400000.0 AS INTEGER
)
WHERE COALESCE(
  json_extract("one_c_value", '$.scheduledStart'),
  json_extract("cv_value", '$.startTime'),
  json_extract("one_c_value", '$.closedAt'),
  json_extract("cv_value", '$.postStayEnd')
) IS NOT NULL;
