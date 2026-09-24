-- AlterTable
ALTER TABLE "ec_sheet_active_snapshots" ADD COLUMN "last_checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
