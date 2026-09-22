CREATE TABLE "ec_drive_connections" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'GOOGLE_DRIVE',
    "email" VARCHAR(254),
    "encrypted_token" TEXT NOT NULL,
    "root_folder_id" TEXT,
    "root_folder_name" TEXT NOT NULL DEFAULT 'MatureX - EC Raw Data',
    "scope" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "connected_by_user_id" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ec_drive_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ec_drive_connections_provider_key"
ON "ec_drive_connections"("provider");

CREATE TABLE "ec_drive_sync_runs" (
    "id" TEXT NOT NULL,
    "shop" VARCHAR(120) NOT NULL,
    "source" VARCHAR(60) NOT NULL,
    "range_from" DATE NOT NULL,
    "range_to" DATE NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    "requested_by" VARCHAR(254),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "drive_file_id" TEXT,
    "drive_file_name" TEXT,
    "drive_file_url" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ec_drive_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ec_drive_sync_runs_shop_source_range_from_range_to_idx"
ON "ec_drive_sync_runs"("shop", "source", "range_from", "range_to");

CREATE INDEX "ec_drive_sync_runs_status_created_at_idx"
ON "ec_drive_sync_runs"("status", "created_at");
