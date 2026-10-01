import assert from "node:assert/strict";
import test from "node:test";
import {
  detectShopFromPath,
  ETSY_SHOPS,
  isCogsFileName,
  isPocdyPath,
  normalizeShopCode,
  SHOPS_MAP,
} from "../fl/etsy-constants";
import { importFilesToFlowaSheet } from "../fl/flowa-sheet-import";

test("ETSY_SHOPS contains exactly 7 active shops with expected codes and names", () => {
  assert.equal(ETSY_SHOPS.length, 7);

  const expectedShops = [
    { code: "EVERNEST", name: "Evernest" },
    { code: "ORIVIA", name: "Orivia" },
    { code: "TIMOND", name: "Timond" },
    { code: "ARTISANHAND", name: "Artisan" },
    { code: "97DECOR", name: "97Decor" },
    { code: "KINDLORA", name: "Kindlora" },
    { code: "EVERMIRTH", name: "Evermirth" },
  ];

  for (const expected of expectedShops) {
    const found = ETSY_SHOPS.find((s) => s.code === expected.code);
    assert.ok(found, `Shop ${expected.code} must exist in ETSY_SHOPS`);
    assert.equal(found.name, expected.name);
  }

  // Ensure POCDY is not in active ETSY_SHOPS
  const pocdy = ETSY_SHOPS.find((s: { code: string }) => s.code === "POCDY");
  assert.equal(pocdy, undefined, "POCDY must not be in active ETSY_SHOPS");
});

test("SHOPS_MAP aliases map correctly and excludes POCDY", () => {
  assert.equal(SHOPS_MAP.ARTISAN, "ARTISANHAND");
  assert.equal(SHOPS_MAP.ARTISANHAND, "ARTISANHAND");
  assert.equal(SHOPS_MAP.ARTISANSHAND, "ARTISANHAND");
  assert.equal(SHOPS_MAP.EVERNEST, "EVERNEST");
  assert.equal(SHOPS_MAP.ORIVIA, "ORIVIA");
  assert.equal(SHOPS_MAP.TIMOND, "TIMOND");
  assert.equal(SHOPS_MAP["97DECOR"], "97DECOR");
  assert.equal(SHOPS_MAP.KINDLORA, "KINDLORA");
  assert.equal(SHOPS_MAP.EVERMIRTH, "EVERMIRTH");
  assert.equal(SHOPS_MAP.POCDY, undefined, "POCDY must not exist in SHOPS_MAP");
});

test("isPocdyPath accurately detects Pocdy codes, directories, and file paths", () => {
  assert.equal(isPocdyPath("POCDY"), true);
  assert.equal(isPocdyPath("pocdy"), true);
  assert.equal(isPocdyPath("FL DATA/Pocdy/EtsySoldOrders2026-8.csv"), true);
  assert.equal(isPocdyPath("FL DATA/Pocdy/OrderManagement_Aug.xlsx"), true);
  assert.equal(isPocdyPath("Pocdy/cogs_claim.csv"), true);
  assert.equal(isPocdyPath("pocdy_cogs.xlsx"), true);

  // Other shops and non-Pocdy files must be false
  assert.equal(isPocdyPath("EVERNEST"), false);
  assert.equal(isPocdyPath("ARTISANHAND"), false);
  assert.equal(isPocdyPath("FL DATA/97Decor/OrderManagement_Aug.xlsx"), false);
  assert.equal(isPocdyPath("FL DATA/Evernest/EtsySoldOrders.csv"), false);
  assert.equal(isPocdyPath("cogs_report_2026.xlsx"), false);
});

test("detectShopFromPath resolves all 7 shops, aliases, COGS, and rejects Pocdy paths", () => {
  // 7 active shops
  assert.equal(
    detectShopFromPath("FL DATA/Evernest/EtsySoldOrderItems2026-8.csv"),
    "EVERNEST",
  );
  assert.equal(
    detectShopFromPath("FL DATA/Orivia/EtsySoldOrders2026-8.csv"),
    "ORIVIA",
  );
  assert.equal(
    detectShopFromPath("FL DATA/Timond/EtsyDirectCheckoutPayments2026-8.csv"),
    "TIMOND",
  );
  assert.equal(
    detectShopFromPath("FL DATA/Artisan/EtsySoldOrders2026-8.csv"),
    "ARTISANHAND",
  );
  assert.equal(
    detectShopFromPath("FL DATA/Artisanhand/EtsySoldOrders2026-8.csv"),
    "ARTISANHAND",
  );
  assert.equal(
    detectShopFromPath("FL DATA/Artisanshand/EtsySoldOrders2026-8.csv"),
    "ARTISANHAND",
  );
  assert.equal(
    detectShopFromPath("FL DATA/97Decor/EtsySoldOrders2026-8.csv"),
    "97DECOR",
  );
  assert.equal(
    detectShopFromPath("FL DATA/Kindlora/EtsySoldOrders2026-8.csv"),
    "KINDLORA",
  );
  assert.equal(
    detectShopFromPath("FL DATA/Evermirth/EtsySoldOrders2026-8.csv"),
    "EVERMIRTH",
  );

  // COGS auto-detection for non-Pocdy paths
  assert.equal(
    detectShopFromPath("FL DATA/SomeFolder/OrderManagement_Aug.xlsx"),
    "97DECOR",
  );
  assert.equal(detectShopFromPath("cogs_report_2026.xlsx"), "97DECOR");
  assert.equal(
    detectShopFromPath("FL DATA/97Decor/OrderManagement_Aug.xlsx"),
    "97DECOR",
  );
  assert.equal(
    detectShopFromPath("FL DATA/Evernest/OrderManagement_Aug.xlsx"),
    "97DECOR",
  );
  assert.equal(
    detectShopFromPath("FL DATA/Evernest/cogs_claim.csv"),
    "97DECOR",
  );

  // Pocdy paths must NEVER resolve to 97DECOR or any shop
  assert.equal(
    detectShopFromPath("FL DATA/Pocdy/EtsySoldOrders2026-8.csv"),
    null,
  );
  assert.equal(
    detectShopFromPath("FL DATA/Pocdy/OrderManagement_Aug.xlsx"),
    null,
  );
  assert.equal(detectShopFromPath("Pocdy/cogs_claim.csv"), null);
  assert.equal(detectShopFromPath("Pocdy/cogs_report.xlsx"), null);
  assert.equal(detectShopFromPath("Pocdy/issue_claim.csv"), null);

  // Unknown
  assert.equal(detectShopFromPath("unknown_file.csv"), null);
});

test("importFilesToFlowaSheet blocks Pocdy selection and prevents assigning Pocdy COGS to 97DECOR", async () => {
  // 1. Explicit POCDY selection must throw immediately
  await assert.rejects(
    async () => {
      await importFilesToFlowaSheet("POCDY", [
        {
          file: new File(["dummy content"], "orders.csv", { type: "text/csv" }),
          relativePath: "orders.csv",
        },
      ]);
    },
    {
      message:
        'Shop "Pocdy" (POCDY) không còn được hỗ trợ. Không thể nhập dữ liệu.',
    },
  );

  // 2. AUTO import with file in Pocdy directory containing COGS name must be rejected, not assigned to 97DECOR
  const dummyFile = new File(["dummy content"], "OrderManagement_Aug.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const { results } = await importFilesToFlowaSheet("AUTO", [
    {
      file: dummyFile,
      relativePath: "FL DATA/Pocdy/OrderManagement_Aug.xlsx",
    },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].status, "FAILED");
  assert.equal(
    results[0].message,
    'Shop "Pocdy" (POCDY) không còn được hỗ trợ. Không thể nhập dữ liệu.',
  );
  assert.notEqual(
    results[0].shopCode,
    "97DECOR",
    "Pocdy COGS file must never be assigned to 97DECOR",
  );
});

test("COGS files are always routed to 97DECOR even when in Evernest folder or manually selected shop", async () => {
  const dummyFile = new File(["dummy content"], "OrderManagement_Aug.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // 1. Manually selected shop is overridden for COGS
  const manualResult = await importFilesToFlowaSheet("EVERNEST", [
    {
      file: dummyFile,
      relativePath: "OrderManagement_Aug.xlsx",
    },
  ]);
  assert.equal(manualResult.results[0].shopCode, "97DECOR");

  // 2. AUTO import with file in Evernest folder is routed to 97DECOR
  const autoResult = await importFilesToFlowaSheet("AUTO", [
    {
      file: dummyFile,
      relativePath: "FL DATA/Evernest/OrderManagement_Aug.xlsx",
    },
  ]);
  assert.equal(autoResult.results[0].shopCode, "97DECOR");

  // 3. Manually selected Timond with claim file is routed to 97DECOR
  const claimFile = new File(["dummy content"], "issue_claim.csv", {
    type: "text/csv",
  });
  const claimResult = await importFilesToFlowaSheet("TIMOND", [
    {
      file: claimFile,
      relativePath: "issue_claim.csv",
    },
  ]);
  assert.equal(claimResult.results[0].shopCode, "97DECOR");
});

test("normalizeShopCode strips accents, spaces, and special characters", () => {
  assert.equal(normalizeShopCode("Artisan's Hand"), "ARTISANSHAND");
  assert.equal(normalizeShopCode("97 Decor"), "97DECOR");
  assert.equal(normalizeShopCode("Örivia"), "ORIVIA");
});

test("isCogsFileName detects cogs, ordermanagement, and claims", () => {
  assert.equal(isCogsFileName("OrderManagement_August.xlsx"), true);
  assert.equal(isCogsFileName("issue_claim_2026.csv"), true);
  assert.equal(isCogsFileName("cogs_report.csv"), true);
  assert.equal(isCogsFileName("EtsySoldOrders2026.csv"), false);
});
