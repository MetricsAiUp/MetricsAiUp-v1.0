-- Индексы для ускорения discrepancyDetector:
--   1) VehicleSession.plateNumber — exact/fuzzy matching в oneCCvMatcher.findMatch
--   2) PostStay.startTime         — фильтр { startTime: { gte: sinceDate } } в detectAll
CREATE INDEX "vehicle_sessions_plate_number_idx" ON "vehicle_sessions"("plate_number");
CREATE INDEX "post_stays_start_time_idx" ON "post_stays"("start_time");
