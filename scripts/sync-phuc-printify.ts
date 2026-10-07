async function main() {
  process.env.USE_NATIVE_PRISMA = "true";
  const required = [
    "DATABASE_URL",
    "GOOGLE_DRIVE_CLIENT_ID",
    "GOOGLE_DRIVE_CLIENT_SECRET",
    "GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY",
    "PHUC_PRINTIFY_ACCESS_TOKEN",
    "PHUC_PRINTIFY_SHOP_ID",
    "PHUC_COGS_SPREADSHEET_ID",
    "PHUC_COGS_SHEET_ID",
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Thiếu cấu hình: ${missing.join(", ")}`);

  const { syncPhucPrintify } = await import("@/lib/fl/printify/sheet-sync");
  const { prisma } = await import("@/lib/prisma");
  try {
    console.log("Starting Printify Team Phuc → RAW.COGS sync (all orders).");
    // Refresh old order statuses as well as fetch newly created orders.
    const result = await syncPhucPrintify();
    console.log("Verified sync result:", JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Printify Team Phuc sync failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
});
