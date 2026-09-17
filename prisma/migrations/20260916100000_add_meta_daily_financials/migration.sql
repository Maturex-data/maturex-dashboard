CREATE TABLE "meta_daily_financials" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "date_start" DATE NOT NULL,
    "date_stop" DATE NOT NULL,
    "currency" TEXT,
    "spend" DECIMAL(18,4) NOT NULL,
    "purchase_count" DECIMAL(18,4) NOT NULL,
    "purchase_value" DECIMAL(18,4) NOT NULL,
    "purchase_roas" DECIMAL(18,6) NOT NULL,
    "cost_per_purchase" DECIMAL(18,6) NOT NULL,
    "impressions" BIGINT NOT NULL,
    "clicks" BIGINT NOT NULL,
    "cpc" DECIMAL(18,6) NOT NULL,
    "cpm" DECIMAL(18,6) NOT NULL,
    "ctr" DECIMAL(18,6) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_daily_financials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_daily_financials_account_id_date_start_key"
ON "meta_daily_financials"("account_id", "date_start");

CREATE INDEX "meta_daily_financials_date_start_idx"
ON "meta_daily_financials"("date_start");
