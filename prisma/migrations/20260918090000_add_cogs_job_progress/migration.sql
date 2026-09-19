ALTER TABLE "cogs_sync_runs"
ADD COLUMN "sync_type" TEXT NOT NULL DEFAULT 'LATEST',
ADD COLUMN "range_from" DATE,
ADD COLUMN "range_to" DATE,
ADD COLUMN "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "cogs_sync_source_runs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "pages_processed" INTEGER NOT NULL DEFAULT 0,
    "total_pages" INTEGER,
    "rows_fetched" INTEGER NOT NULL DEFAULT 0,
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB,
    "started_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    CONSTRAINT "cogs_sync_source_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cogs_sync_source_runs_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "cogs_sync_runs"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "cogs_sync_runs_status_heartbeat_at_idx"
ON "cogs_sync_runs"("status", "heartbeat_at");

CREATE UNIQUE INDEX "cogs_sync_source_runs_run_id_source_key"
ON "cogs_sync_source_runs"("run_id", "source");

CREATE INDEX "cogs_sync_source_runs_run_id_status_idx"
ON "cogs_sync_source_runs"("run_id", "status");
