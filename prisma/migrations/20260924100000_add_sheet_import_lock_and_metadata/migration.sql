-- AlterTable
ALTER TABLE "ec_sheet_import_runs" ADD COLUMN "trigger_type" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "error_category" VARCHAR(50);

-- CreateIndex
CREATE INDEX "ec_sheet_import_runs_trigger_type_idx" ON "ec_sheet_import_runs"("trigger_type");

-- CreateTable
CREATE TABLE "ec_sheet_import_locks" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by" VARCHAR(100),
    "locked_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),

    CONSTRAINT "ec_sheet_import_locks_pkey" PRIMARY KEY ("id")
);

-- Insert singleton lock record if not exists
INSERT INTO "ec_sheet_import_locks" ("id", "is_locked")
VALUES (1, false)
ON CONFLICT ("id") DO NOTHING;
