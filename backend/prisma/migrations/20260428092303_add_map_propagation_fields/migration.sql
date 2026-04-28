-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cameras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rtsp_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME
);
INSERT INTO "new_cameras" ("id", "is_active", "name", "rtsp_url") SELECT "id", "is_active", "name", "rtsp_url" FROM "cameras";
DROP TABLE "cameras";
ALTER TABLE "new_cameras" RENAME TO "cameras";
CREATE INDEX "cameras_deleted_idx" ON "cameras"("deleted");
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
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "posts_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_posts" ("coordinates", "created_at", "id", "is_active", "name", "status", "type", "updated_at", "zone_id") SELECT "coordinates", "created_at", "id", "is_active", "name", "status", "type", "updated_at", "zone_id" FROM "posts";
DROP TABLE "posts";
ALTER TABLE "new_posts" RENAME TO "posts";
CREATE UNIQUE INDEX "posts_number_key" ON "posts"("number");
CREATE INDEX "posts_is_active_idx" ON "posts"("is_active");
CREATE INDEX "posts_zone_id_idx" ON "posts"("zone_id");
CREATE INDEX "posts_deleted_idx" ON "posts"("deleted");
CREATE TABLE "new_zones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'repair',
    "description" TEXT,
    "coordinates" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_name" TEXT,
    "display_name_en" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_zones" ("coordinates", "created_at", "description", "id", "is_active", "name", "type", "updated_at") SELECT "coordinates", "created_at", "description", "id", "is_active", "name", "type", "updated_at" FROM "zones";
DROP TABLE "zones";
ALTER TABLE "new_zones" RENAME TO "zones";
CREATE INDEX "zones_is_active_idx" ON "zones"("is_active");
CREATE INDEX "zones_deleted_idx" ON "zones"("deleted");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

