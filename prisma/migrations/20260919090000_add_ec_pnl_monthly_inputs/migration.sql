CREATE TABLE "ec_pnl_monthly_inputs" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "subscription_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "confirmed_tools_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "vietnam_tools_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "personnel_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "allocated_overhead_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "welfare_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ec_pnl_monthly_inputs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ec_pnl_monthly_inputs_month_key"
ON "ec_pnl_monthly_inputs"("month");

CREATE INDEX "ec_pnl_monthly_inputs_month_idx"
ON "ec_pnl_monthly_inputs"("month");

INSERT INTO "ec_pnl_monthly_inputs" (
    "id",
    "month",
    "subscription_cost",
    "confirmed_tools_cost",
    "vietnam_tools_cost",
    "personnel_cost",
    "allocated_overhead_cost",
    "welfare_cost",
    "note"
) VALUES
(
    'ec-pnl-2026-07',
    DATE '2026-07-01',
    53.99,
    1685.27,
    249750.0 / 26500.0,
    95992539.0 / 26500.0,
    72000000.0 / 26500.0,
    0,
    'Seeded from EcomCreate_TheDeerly_PL_JulAug2026_FINAL (12).xlsx'
),
(
    'ec-pnl-2026-08',
    DATE '2026-08-01',
    29.00,
    1685.91,
    249750.0 / 26500.0,
    96103966.0 / 26500.0,
    72000000.0 / 26500.0,
    2500000.0 / 26500.0,
    'Seeded from EcomCreate_TheDeerly_PL_JulAug2026_FINAL (12).xlsx'
)
ON CONFLICT ("month") DO NOTHING;
