-- External CV Monitoring API v2.1.0: store TZ sibling for each external date field.
-- Additive only. Existing rows get NULL. Code keeps reading existing UTC DateTime columns;
-- new *_tz columns are populated from `<X>Tz` siblings in the API response when available.

-- MonitoringSnapshot
ALTER TABLE "monitoring_snapshots" ADD COLUMN "car_first_seen_tz" TEXT;
ALTER TABLE "monitoring_snapshots" ADD COLUMN "external_update_tz" TEXT;
ALTER TABLE "monitoring_snapshots" ADD COLUMN "timestamp_tz" TEXT;

-- MonitoringCurrent
ALTER TABLE "monitoring_current" ADD COLUMN "car_first_seen_tz" TEXT;
ALTER TABLE "monitoring_current" ADD COLUMN "external_update_tz" TEXT;
