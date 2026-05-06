-- CreateTable
CREATE TABLE "one_c_imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT NOT NULL,
    "message_id" TEXT,
    "from_address" TEXT NOT NULL,
    "subject" TEXT,
    "received_at" DATETIME NOT NULL,
    "processed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'imap',
    "uploaded_by" TEXT,
    "attachment_name" TEXT,
    "attachment_size" INTEGER,
    "detected_type" TEXT,
    "rows_total" INTEGER NOT NULL DEFAULT 0,
    "rows_inserted" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "one_c_plan_rows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "import_id" TEXT NOT NULL,
    "document_text" TEXT NOT NULL,
    "document_type" TEXT,
    "organization" TEXT,
    "vehicle_text" TEXT,
    "number" TEXT NOT NULL,
    "plate_number" TEXT,
    "vin" TEXT,
    "scheduled_start" DATETIME NOT NULL,
    "scheduled_end" DATETIME NOT NULL,
    "post_raw_name" TEXT NOT NULL,
    "post_id" TEXT,
    "duration_sec" INTEGER,
    "is_outdated" BOOLEAN NOT NULL DEFAULT false,
    "received_at" DATETIME NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "one_c_plan_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "one_c_imports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "one_c_repair_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "import_id" TEXT NOT NULL,
    "vehicle_text" TEXT,
    "vin" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "plate_number_1" TEXT,
    "plate_number_2" TEXT,
    "warranty_end" DATETIME,
    "year_made" INTEGER,
    "order_text" TEXT,
    "order_number" TEXT NOT NULL,
    "order_date" DATETIME NOT NULL,
    "state" TEXT NOT NULL,
    "repair_kind" TEXT,
    "mileage" INTEGER,
    "work_started_at" DATETIME,
    "work_finished_at" DATETIME,
    "closed_at" DATETIME,
    "basis" TEXT,
    "basis_start" DATETIME,
    "basis_end" DATETIME,
    "master" TEXT,
    "dispatcher" TEXT,
    "received_at" DATETIME NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "one_c_repair_snapshots_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "one_c_imports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "one_c_work_performed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "import_id" TEXT NOT NULL,
    "vehicle_text" TEXT,
    "vin" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "plate_number" TEXT,
    "year_made" INTEGER,
    "order_text" TEXT,
    "order_number" TEXT NOT NULL,
    "order_date" DATETIME NOT NULL,
    "repair_kind" TEXT,
    "state" TEXT NOT NULL,
    "work_started_at" DATETIME,
    "work_finished_at" DATETIME,
    "closed_at" DATETIME NOT NULL,
    "master" TEXT,
    "dispatcher" TEXT,
    "executor" TEXT,
    "basis_plate_number" TEXT,
    "mileage" INTEGER,
    "cause_description" TEXT,
    "norm_hours" REAL,
    "received_at" DATETIME NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "one_c_work_performed_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "one_c_imports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "one_c_work_order_merged" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "vin" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "plate_number" TEXT,
    "year_made" INTEGER,
    "mileage" INTEGER,
    "order_date" DATETIME,
    "scheduled_start" DATETIME,
    "scheduled_end" DATETIME,
    "work_started_at" DATETIME,
    "work_finished_at" DATETIME,
    "closed_at" DATETIME,
    "state" TEXT,
    "document_type" TEXT,
    "organization" TEXT,
    "repair_kind" TEXT,
    "basis" TEXT,
    "master" TEXT,
    "dispatcher" TEXT,
    "executor" TEXT,
    "cause_description" TEXT,
    "norm_hours" REAL,
    "in_plan" BOOLEAN NOT NULL DEFAULT false,
    "in_repair" BOOLEAN NOT NULL DEFAULT false,
    "in_performed" BOOLEAN NOT NULL DEFAULT false,
    "content_hash" TEXT NOT NULL,
    "received_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "one_c_stage_merged" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "post_raw_name" TEXT NOT NULL,
    "post_id" TEXT,
    "scheduled_start" DATETIME NOT NULL,
    "scheduled_end" DATETIME NOT NULL,
    "duration_sec" INTEGER,
    "is_outdated" BOOLEAN NOT NULL DEFAULT false,
    "vin" TEXT,
    "plate_number" TEXT,
    "content_hash" TEXT NOT NULL,
    "received_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "one_c_unmapped_posts" (
    "raw_name" TEXT NOT NULL PRIMARY KEY,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_post_id" TEXT,
    "resolved_as_non_tracked" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" DATETIME
);

-- CreateTable
CREATE TABLE "one_c_cv_match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "vehicle_session_id" TEXT,
    "post_stay_id" TEXT,
    "match_type" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "window_applied" BOOLEAN NOT NULL DEFAULT false,
    "matched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" TEXT
);

-- CreateTable
CREATE TABLE "discrepancies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'open',
    "order_number" TEXT,
    "vehicle_session_id" TEXT,
    "post_id" TEXT,
    "plate_number" TEXT,
    "vin" TEXT,
    "one_c_value" TEXT,
    "cv_value" TEXT,
    "description" TEXT NOT NULL,
    "description_en" TEXT,
    "detected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" DATETIME,
    "acknowledged_by" TEXT,
    "resolved_at" DATETIME,
    "resolved_by" TEXT,
    "close_reason" TEXT,
    "close_comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "imap_1c_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "host" TEXT NOT NULL DEFAULT 'imap.gmail.com',
    "port" INTEGER NOT NULL DEFAULT 993,
    "use_ssl" BOOLEAN NOT NULL DEFAULT true,
    "user" TEXT NOT NULL DEFAULT '',
    "password_encrypted" TEXT NOT NULL DEFAULT '',
    "from_filter" TEXT NOT NULL DEFAULT 'zakaz@paradavto.by',
    "subject_mask" TEXT,
    "interval_minutes" INTEGER NOT NULL DEFAULT 30,
    "match_window_hours" INTEGER NOT NULL DEFAULT 24,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mark_as_read" BOOLEAN NOT NULL DEFAULT true,
    "delete_after_days" INTEGER,
    "last_fetch_at" DATETIME,
    "last_fetch_status" TEXT,
    "last_fetch_error" TEXT,
    "updated_at" DATETIME NOT NULL,
    "updated_by" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zone_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'light',
    "status" TEXT NOT NULL DEFAULT 'free',
    "coordinates" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "number" INTEGER,
    "display_name" TEXT,
    "display_name_en" TEXT,
    "external_zone_name" TEXT,
    "external_aliases" TEXT,
    "is_tracked" BOOLEAN NOT NULL DEFAULT true,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "posts_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_posts" ("coordinates", "created_at", "deleted", "deleted_at", "display_name", "display_name_en", "external_aliases", "external_zone_name", "id", "is_active", "name", "number", "status", "type", "updated_at", "zone_id") SELECT "coordinates", "created_at", "deleted", "deleted_at", "display_name", "display_name_en", "external_aliases", "external_zone_name", "id", "is_active", "name", "number", "status", "type", "updated_at", "zone_id" FROM "posts";
DROP TABLE "posts";
ALTER TABLE "new_posts" RENAME TO "posts";
CREATE UNIQUE INDEX "posts_number_key" ON "posts"("number");
CREATE INDEX "posts_is_active_idx" ON "posts"("is_active");
CREATE INDEX "posts_zone_id_idx" ON "posts"("zone_id");
CREATE INDEX "posts_deleted_idx" ON "posts"("deleted");
CREATE INDEX "posts_is_tracked_idx" ON "posts"("is_tracked");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hidden_elements" TEXT NOT NULL DEFAULT '[]',
    "pages" TEXT NOT NULL DEFAULT '[]',
    "ui_state" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("created_at", "email", "first_name", "hidden_elements", "id", "is_active", "last_name", "pages", "password", "updated_at") SELECT "created_at", "email", "first_name", "hidden_elements", "id", "is_active", "last_name", "pages", "password", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "one_c_imports_received_at_idx" ON "one_c_imports"("received_at");

-- CreateIndex
CREATE INDEX "one_c_imports_status_idx" ON "one_c_imports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "one_c_imports_uid_attachment_name_key" ON "one_c_imports"("uid", "attachment_name");

-- CreateIndex
CREATE INDEX "one_c_plan_rows_number_idx" ON "one_c_plan_rows"("number");

-- CreateIndex
CREATE INDEX "one_c_plan_rows_plate_number_idx" ON "one_c_plan_rows"("plate_number");

-- CreateIndex
CREATE INDEX "one_c_plan_rows_vin_idx" ON "one_c_plan_rows"("vin");

-- CreateIndex
CREATE INDEX "one_c_plan_rows_scheduled_start_idx" ON "one_c_plan_rows"("scheduled_start");

-- CreateIndex
CREATE INDEX "one_c_plan_rows_received_at_idx" ON "one_c_plan_rows"("received_at");

-- CreateIndex
CREATE INDEX "one_c_plan_rows_content_hash_idx" ON "one_c_plan_rows"("content_hash");

-- CreateIndex
CREATE INDEX "one_c_repair_snapshots_order_number_idx" ON "one_c_repair_snapshots"("order_number");

-- CreateIndex
CREATE INDEX "one_c_repair_snapshots_vin_idx" ON "one_c_repair_snapshots"("vin");

-- CreateIndex
CREATE INDEX "one_c_repair_snapshots_plate_number_1_idx" ON "one_c_repair_snapshots"("plate_number_1");

-- CreateIndex
CREATE INDEX "one_c_repair_snapshots_state_idx" ON "one_c_repair_snapshots"("state");

-- CreateIndex
CREATE INDEX "one_c_repair_snapshots_received_at_idx" ON "one_c_repair_snapshots"("received_at");

-- CreateIndex
CREATE INDEX "one_c_repair_snapshots_content_hash_idx" ON "one_c_repair_snapshots"("content_hash");

-- CreateIndex
CREATE INDEX "one_c_work_performed_order_number_idx" ON "one_c_work_performed"("order_number");

-- CreateIndex
CREATE INDEX "one_c_work_performed_vin_idx" ON "one_c_work_performed"("vin");

-- CreateIndex
CREATE INDEX "one_c_work_performed_plate_number_idx" ON "one_c_work_performed"("plate_number");

-- CreateIndex
CREATE INDEX "one_c_work_performed_executor_idx" ON "one_c_work_performed"("executor");

-- CreateIndex
CREATE INDEX "one_c_work_performed_closed_at_idx" ON "one_c_work_performed"("closed_at");

-- CreateIndex
CREATE INDEX "one_c_work_performed_received_at_idx" ON "one_c_work_performed"("received_at");

-- CreateIndex
CREATE INDEX "one_c_work_performed_content_hash_idx" ON "one_c_work_performed"("content_hash");

-- CreateIndex
CREATE INDEX "one_c_work_order_merged_order_number_received_at_idx" ON "one_c_work_order_merged"("order_number", "received_at" DESC);

-- CreateIndex
CREATE INDEX "one_c_work_order_merged_vin_idx" ON "one_c_work_order_merged"("vin");

-- CreateIndex
CREATE INDEX "one_c_work_order_merged_plate_number_idx" ON "one_c_work_order_merged"("plate_number");

-- CreateIndex
CREATE INDEX "one_c_work_order_merged_state_idx" ON "one_c_work_order_merged"("state");

-- CreateIndex
CREATE INDEX "one_c_work_order_merged_executor_idx" ON "one_c_work_order_merged"("executor");

-- CreateIndex
CREATE INDEX "one_c_work_order_merged_content_hash_idx" ON "one_c_work_order_merged"("content_hash");

-- CreateIndex
CREATE INDEX "one_c_stage_merged_order_number_post_raw_name_scheduled_start_received_at_idx" ON "one_c_stage_merged"("order_number", "post_raw_name", "scheduled_start", "received_at" DESC);

-- CreateIndex
CREATE INDEX "one_c_stage_merged_post_id_scheduled_start_idx" ON "one_c_stage_merged"("post_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "one_c_stage_merged_scheduled_start_idx" ON "one_c_stage_merged"("scheduled_start");

-- CreateIndex
CREATE INDEX "one_c_stage_merged_content_hash_idx" ON "one_c_stage_merged"("content_hash");

-- CreateIndex
CREATE INDEX "one_c_unmapped_posts_resolved_idx" ON "one_c_unmapped_posts"("resolved");

-- CreateIndex
CREATE INDEX "one_c_cv_match_order_number_idx" ON "one_c_cv_match"("order_number");

-- CreateIndex
CREATE INDEX "one_c_cv_match_vehicle_session_id_idx" ON "one_c_cv_match"("vehicle_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "one_c_cv_match_order_number_vehicle_session_id_key" ON "one_c_cv_match"("order_number", "vehicle_session_id");

-- CreateIndex
CREATE INDEX "discrepancies_status_severity_detected_at_idx" ON "discrepancies"("status", "severity", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "discrepancies_type_idx" ON "discrepancies"("type");

-- CreateIndex
CREATE INDEX "discrepancies_order_number_idx" ON "discrepancies"("order_number");

-- CreateIndex
CREATE INDEX "discrepancies_post_id_idx" ON "discrepancies"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "discrepancies_type_order_number_post_id_vehicle_session_id_key" ON "discrepancies"("type", "order_number", "post_id", "vehicle_session_id");

