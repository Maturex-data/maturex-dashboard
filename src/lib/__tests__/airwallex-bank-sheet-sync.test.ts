import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import zlib from "node:zlib";
import * as XLSX from "xlsx";
import {
  airwallexGet,
  BANK_HEADERS,
  fetchAirwallexBankRows,
  monthWindow,
  type RecordValue,
  syncAirwallexBankToSheet,
  vietnamDate,
} from "../airwallex-bank-sheet-sync";

const MOCK_ACCOUNT_ID = "act_mock_maturex_123";
const PREV_ACCOUNT_ID = process.env.AIRWALLEX_ACCOUNT_ID;

function setupMockAccount() {
  process.env.AIRWALLEX_ACCOUNT_ID = MOCK_ACCOUNT_ID;
}

function restoreMockAccount() {
  process.env.AIRWALLEX_ACCOUNT_ID = PREV_ACCOUNT_ID;
}

test("1. Giao dịch tạo tháng trước nhưng posted tháng này", async () => {
  setupMockAccount();
  try {
    const augustCreatedDate = "2026-08-31T20:30:00.000Z";
    const septemberSettledDate = "2026-09-01T01:05:00.000Z";
    const septemberPostedDate = "2026-09-01T08:05:00+0800";

    const rows = await fetchAirwallexBankRows("2026-09", {
      login: async () => "mock-token",
      get: async (_token, path) => {
        if (path === "/api/v1/account") {
          return {
            id: MOCK_ACCOUNT_ID,
            account_details: {
              business_details: { business_name: "MatureX LLC" },
            },
          };
        }
        return {};
      },
      numberedPages: async (_token, path, params) => {
        if (path === "/api/v1/financial_transactions") {
          assert.equal(
            params.from_created_at,
            "2025-12-31T17:00:00.000Z",
            "Phải quét từ 01/01/2026 (theo ICT) để không sót giao dịch tạo tháng trước",
          );
          return [
            {
              id: "ftx_august_to_sept",
              status: "SETTLED",
              currency: "USD",
              transaction_type: "DEPOSIT",
              net: 500,
              created_at: augustCreatedDate,
              settled_at: septemberSettledDate,
              source_id: "dep_123",
            },
          ];
        }
        if (path === "/api/v1/issuing/transactions") return [];
        return [];
      },
      historyRows: async () => [
        {
          id: "hist_1",
          source: "dep_123",
          transaction_type: "DEPOSIT",
          amount: 500,
          currency: "USD",
          account_type: "cash",
          posted_at: septemberPostedDate,
          balance: 10500,
        },
      ],
      deposits: async () => [
        {
          deposit_id: "dep_123",
          global_account_id: "ga_1",
        },
      ],
      globalAccounts: async () => [
        {
          id: "ga_1",
          account_number: "8489740082",
        },
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "ftx_august_to_sept");
    assert.equal(rows[0].values[0], "2026-09-01"); // Ngày ghi sổ theo ICT
    assert.equal(rows[0].values[1], septemberPostedDate);
    assert.equal(rows[0].values[8], 10500); // Tồn từ balance history
    assert.equal(rows[0].values[20], "8489740082"); // STK
  } finally {
    restoreMockAccount();
  }
});

test("2. Deduplicate Card ID: nhiều giao dịch cùng thẻ chỉ gọi API card một lần", async () => {
  setupMockAccount();
  try {
    const cardApiCalls: string[] = [];

    const rows = await fetchAirwallexBankRows("2026-09", {
      login: async () => "mock-token",
      get: async (_token, path) => {
        if (path === "/api/v1/account") {
          return {
            id: MOCK_ACCOUNT_ID,
            account_details: {
              business_details: { business_name: "MatureX LLC" },
            },
          };
        }
        if (path.startsWith("/api/v1/issuing/cards/")) {
          cardApiCalls.push(path);
          return {
            card_id: "card_shared_999",
            nick_name: "Operations Card",
          };
        }
        return {};
      },
      numberedPages: async (_token, path) => {
        if (path === "/api/v1/financial_transactions") {
          return [
            {
              id: "ftx_c1",
              status: "SETTLED",
              currency: "USD",
              transaction_type: "ISSUING_CAPTURE",
              net: -15,
              settled_at: "2026-09-05T10:00:00Z",
            },
            {
              id: "ftx_c2",
              status: "SETTLED",
              currency: "USD",
              transaction_type: "ISSUING_CAPTURE",
              net: -25,
              settled_at: "2026-09-06T10:00:00Z",
            },
            {
              id: "ftx_c3",
              status: "SETTLED",
              currency: "USD",
              transaction_type: "ISSUING_CAPTURE",
              net: -35,
              settled_at: "2026-09-07T10:00:00Z",
            },
          ];
        }
        if (path === "/api/v1/issuing/transactions") {
          return [
            {
              transaction_id: "ftx_c1",
              card_id: "card_shared_999",
              masked_card_number: "************9999",
              retrieval_ref: "ref_1",
            },
            {
              transaction_id: "ftx_c2",
              card_id: "card_shared_999",
              masked_card_number: "************9999",
              retrieval_ref: "ref_2",
            },
            {
              transaction_id: "ftx_c3",
              card_id: "card_shared_999",
              masked_card_number: "************9999",
              retrieval_ref: "ref_3",
            },
          ];
        }
        return [];
      },
      historyRows: async () => [
        {
          id: "h1",
          source: "ref_1",
          transaction_type: "ISSUING_CAPTURE",
          amount: -15,
          currency: "USD",
          account_type: "cash",
          posted_at: "2026-09-05T18:00:00+0800",
          balance: 9000,
        },
        {
          id: "h2",
          source: "ref_2",
          transaction_type: "ISSUING_CAPTURE",
          amount: -25,
          currency: "USD",
          account_type: "cash",
          posted_at: "2026-09-06T18:00:00+0800",
          balance: 8975,
        },
        {
          id: "h3",
          source: "ref_3",
          transaction_type: "ISSUING_CAPTURE",
          amount: -35,
          currency: "USD",
          account_type: "cash",
          posted_at: "2026-09-07T18:00:00+0800",
          balance: 8940,
        },
      ],
    });

    assert.equal(rows.length, 3);
    assert.equal(
      cardApiCalls.length,
      1,
      "Chỉ được gọi /api/v1/issuing/cards/{id} 1 lần cho cùng một card_id",
    );
    assert.equal(cardApiCalls[0], "/api/v1/issuing/cards/card_shared_999");
    for (const r of rows) {
      assert.equal(r.values[4], "card_shared_999");
      assert.equal(r.values[20], "************9999");
      assert.equal(r.values[21], "Operations Card");
    }
  } finally {
    restoreMockAccount();
  }
});

test("3. Nhiều giao dịch cùng số tiền ghép đúng bằng chứng duy nhất", async () => {
  setupMockAccount();
  try {
    const rows = await fetchAirwallexBankRows("2026-09", {
      login: async () => "mock-token",
      get: async (_token, path) => {
        if (path === "/api/v1/account") {
          return {
            id: MOCK_ACCOUNT_ID,
            account_details: {
              business_details: { business_name: "MatureX LLC" },
            },
          };
        }
        return {};
      },
      numberedPages: async (_token, path) => {
        if (path === "/api/v1/financial_transactions") {
          return [
            {
              id: "ftx_same_1",
              status: "SETTLED",
              currency: "USD",
              transaction_type: "DEPOSIT",
              net: 100,
              settled_at: "2026-09-10T10:00:00Z",
              source_id: "dep_same_1",
            },
            {
              id: "ftx_same_2",
              status: "SETTLED",
              currency: "USD",
              transaction_type: "DEPOSIT",
              net: 100,
              settled_at: "2026-09-11T10:00:00Z",
              source_id: "dep_same_2",
            },
          ];
        }
        if (path === "/api/v1/issuing/transactions") return [];
        return [];
      },
      historyRows: async () => [
        {
          id: "hist_same_1",
          source: "dep_same_1",
          transaction_type: "DEPOSIT",
          amount: 100,
          currency: "USD",
          account_type: "cash",
          posted_at: "2026-09-10T17:00:00+0800",
          balance: 5100,
        },
        {
          id: "hist_same_2",
          source: "dep_same_2",
          transaction_type: "DEPOSIT",
          amount: 100,
          currency: "USD",
          account_type: "cash",
          posted_at: "2026-09-11T17:00:00+0800",
          balance: 5200,
        },
      ],
      deposits: async () => [
        { deposit_id: "dep_same_1" },
        { deposit_id: "dep_same_2" },
      ],
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, "ftx_same_1");
    assert.equal(rows[0].values[8], 5100);
    assert.equal(rows[1].id, "ftx_same_2");
    assert.equal(rows[1].values[8], 5200);
  } finally {
    restoreMockAccount();
  }
});

test("4. Balance history thiếu hoặc trùng phải báo lỗi", async () => {
  setupMockAccount();
  try {
    // 4a: Missing balance history
    await assert.rejects(
      async () => {
        await fetchAirwallexBankRows("2026-09", {
          login: async () => "mock-token",
          get: async (_token, path) => {
            if (path === "/api/v1/account") {
              return {
                id: MOCK_ACCOUNT_ID,
                account_details: {
                  business_details: { business_name: "MatureX LLC" },
                },
              };
            }
            return {};
          },
          numberedPages: async (_token, path) => {
            if (path === "/api/v1/financial_transactions") {
              return [
                {
                  id: "ftx_missing_hist",
                  status: "SETTLED",
                  currency: "USD",
                  transaction_type: "PURCHASE",
                  net: -50,
                  settled_at: "2026-09-15T12:00:00Z",
                  source_id: "pur_1",
                },
              ];
            }
            return [];
          },
          historyRows: async () => [],
        });
      },
      {
        message:
          /Không ghép được balance history cho financial transaction ftx_missing_hist/,
      },
    );

    // 4b: Duplicate balance history matching same transaction
    await assert.rejects(
      async () => {
        await fetchAirwallexBankRows("2026-09", {
          login: async () => "mock-token",
          get: async (_token, path) => {
            if (path === "/api/v1/account") {
              return {
                id: MOCK_ACCOUNT_ID,
                account_details: {
                  business_details: { business_name: "MatureX LLC" },
                },
              };
            }
            return {};
          },
          numberedPages: async (_token, path) => {
            if (path === "/api/v1/financial_transactions") {
              return [
                {
                  id: "ftx_ambiguous",
                  status: "SETTLED",
                  currency: "USD",
                  transaction_type: "PURCHASE",
                  net: -50,
                  settled_at: "2026-09-15T12:00:00Z",
                  source_id: "pur_1",
                },
              ];
            }
            return [];
          },
          historyRows: async () => [
            {
              id: "h_amb_1",
              source: "pur_1",
              transaction_type: "PURCHASE",
              amount: -50,
              currency: "USD",
              account_type: "cash",
              posted_at: "2026-09-15T12:00:00+0800",
              balance: 1000,
            },
            {
              id: "h_amb_2",
              source: "pur_1",
              transaction_type: "PURCHASE",
              amount: -50,
              currency: "USD",
              account_type: "cash",
              posted_at: "2026-09-15T12:00:00+0800",
              balance: 950,
            },
          ],
        });
      },
      {
        message:
          /Balance history không duy nhất cho financial transaction ftx_ambiguous/,
      },
    );
  } finally {
    restoreMockAccount();
  }
});

test("5. Phân trang đầy đủ cho danh sách giao dịch", async () => {
  setupMockAccount();
  try {
    let pagesRequested = 0;

    const rows = await fetchAirwallexBankRows("2026-09", {
      login: async () => "mock-token",
      get: async (_token, path, params = {}) => {
        if (path === "/api/v1/account") {
          return {
            id: MOCK_ACCOUNT_ID,
            account_details: {
              business_details: { business_name: "MatureX LLC" },
            },
          };
        }
        if (path === "/api/v1/financial_transactions") {
          pagesRequested += 1;
          const pageNum = Number(params.page_num || 0);
          if (pageNum === 0) {
            return {
              items: [
                {
                  id: "ftx_p1",
                  status: "SETTLED",
                  currency: "USD",
                  transaction_type: "PURCHASE",
                  net: -10,
                  settled_at: "2026-09-02T10:00:00Z",
                  source_id: "src_p1",
                },
              ],
              has_more: true,
            };
          }
          return {
            items: [
              {
                id: "ftx_p2",
                status: "SETTLED",
                currency: "USD",
                transaction_type: "PURCHASE",
                net: -20,
                settled_at: "2026-09-03T10:00:00Z",
                source_id: "src_p2",
              },
            ],
            has_more: false,
          };
        }
        if (path === "/api/v1/issuing/transactions") {
          return { items: [], has_more: false };
        }
        return {};
      },
      historyRows: async () => [
        {
          id: "hp1",
          source: "src_p1",
          transaction_type: "PURCHASE",
          amount: -10,
          currency: "USD",
          account_type: "cash",
          posted_at: "2026-09-02T18:00:00+0800",
          balance: 5000,
        },
        {
          id: "hp2",
          source: "src_p2",
          transaction_type: "PURCHASE",
          amount: -20,
          currency: "USD",
          account_type: "cash",
          posted_at: "2026-09-03T18:00:00+0800",
          balance: 4980,
        },
      ],
    });

    assert.equal(pagesRequested, 2, "Đã gọi đủ 2 trang phân trang");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, "ftx_p1");
    assert.equal(rows[1].id, "ftx_p2");
  } finally {
    restoreMockAccount();
  }
});

test("6. Xử lý 429 và retry trong API client", async () => {
  setupMockAccount();
  process.env.AIRWALLEX_RETRY_BASE_MS = "1";
  const origFetch = globalThis.fetch;
  let attempts = 0;

  try {
    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => {
      attempts += 1;
      if (attempts < 3) {
        return new Response(
          JSON.stringify({ code: "TOO_MANY_REQUESTS", message: "Rate limit" }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          id: MOCK_ACCOUNT_ID,
          account_details: {
            business_details: { business_name: "MatureX LLC" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const data = await airwallexGet("mock-token", "/api/v1/account");
    assert.equal(attempts, 3, "Đã thử lại 3 lần sau 2 lần gặp 429");
    assert.equal(data.id, MOCK_ACCOUNT_ID);
  } finally {
    globalThis.fetch = origFetch;
    delete process.env.AIRWALLEX_RETRY_BASE_MS;
    restoreMockAccount();
  }
});

test("7. Sync lặp là idempotent: không tạo dòng trùng", async () => {
  setupMockAccount();
  try {
    const existingRow = [
      "2026-09-10",
      "2026-09-10T17:00:00+0800",
      "MatureX LLC",
      "Tài khoản",
      "",
      "USD",
      100,
      "",
      5100,
      "Dự án Alpha", // J manual
      "Store Beta", // K manual
      "DEPOSIT",
      "NB_123", // M manual
      "dep_same_1",
      "ftx_repeat_1", // O ID
      "Shopify payout",
      "/api/v1/financial_transactions",
      "Row_55", // R manual
      "Khớp financial transaction với balance history",
      "Ghi chú quan trọng", // T manual
      "8489740082",
      "",
    ];

    const sheetData: unknown[][] = [
      BANK_HEADERS as unknown as unknown[],
      existingRow,
    ];

    const result = await syncAirwallexBankToSheet("2026-09", {
      airwallexContext: {
        login: async () => "mock-token",
        get: async (_token, path) => {
          if (path === "/api/v1/account") {
            return {
              id: MOCK_ACCOUNT_ID,
              account_details: {
                business_details: { business_name: "MatureX LLC" },
              },
            };
          }
          return {};
        },
        numberedPages: async (_token, path) => {
          if (path === "/api/v1/financial_transactions") {
            return [
              {
                id: "ftx_repeat_1",
                status: "SETTLED",
                currency: "USD",
                transaction_type: "DEPOSIT",
                net: 100,
                settled_at: "2026-09-10T10:00:00Z",
                source_id: "dep_same_1",
                description: "Shopify payout",
              },
            ];
          }
          return [];
        },
        historyRows: async () => [
          {
            id: "hist_rep_1",
            source: "dep_same_1",
            transaction_type: "DEPOSIT",
            amount: 100,
            currency: "USD",
            account_type: "cash",
            posted_at: "2026-09-10T17:00:00+0800",
            balance: 5100,
          },
        ],
        deposits: async () => [
          { deposit_id: "dep_same_1", global_account_id: "ga_1" },
        ],
        globalAccounts: async () => [
          { id: "ga_1", account_number: "8489740082" },
        ],
      },
      sheetsContext: {
        getGoogleDriveAccess: async () => ({ accessToken: "sheet-token" }),
        sheetsRequest: async () => ({
          sheets: [
            {
              properties: {
                sheetId: 123,
                title: "RAW ngân hàng",
                gridProperties: { rowCount: 100, columnCount: 22 },
              },
            },
          ],
        }),
        readSheet: async () => sheetData,
      },
    });

    assert.equal(result.fetched, 1);
    assert.equal(result.added, 0, "Không thêm dòng mới khi ID đã tồn tại");
    assert.equal(result.updated, 0, "Dữ liệu không đổi nên không ghi đè");
    assert.equal(result.unchanged, 1);
  } finally {
    restoreMockAccount();
  }
});

test("8. Giữ nguyên các cột thủ công J, K, M, R, T khi cập nhật", async () => {
  setupMockAccount();
  try {
    const existingRow = [
      "2026-09-10",
      "2026-09-10T17:00:00+0800",
      "MatureX LLC",
      "Tài khoản",
      "",
      "USD",
      100,
      "",
      5100,
      "Dự án Alpha", // J (index 9) - PRESERVE
      "Store Beta", // K (index 10) - PRESERVE
      "DEPOSIT",
      "NB_123", // M (index 12) - PRESERVE
      "dep_same_1",
      "ftx_update_1", // O (index 14)
      "Old description", // P (index 15) -> Will change to "New description"
      "/api/v1/financial_transactions",
      "Row_55", // R (index 17) - PRESERVE
      "Khớp financial transaction với balance history",
      "Ghi chú quan trọng", // T (index 19) - PRESERVE
      "8489740082",
      "",
    ];

    const sheetData: unknown[][] = [
      BANK_HEADERS as unknown as unknown[],
      existingRow,
    ];
    const writtenBatches: Array<{ range: string; values: unknown[][] }> = [];

    const result = await syncAirwallexBankToSheet("2026-09", {
      airwallexContext: {
        login: async () => "mock-token",
        get: async (_token, path) => {
          if (path === "/api/v1/account") {
            return {
              id: MOCK_ACCOUNT_ID,
              account_details: {
                business_details: { business_name: "MatureX LLC" },
              },
            };
          }
          return {};
        },
        numberedPages: async (_token, path) => {
          if (path === "/api/v1/financial_transactions") {
            return [
              {
                id: "ftx_update_1",
                status: "SETTLED",
                currency: "USD",
                transaction_type: "DEPOSIT",
                net: 100,
                settled_at: "2026-09-10T10:00:00Z",
                source_id: "dep_same_1",
                description: "New description", // Changed description!
              },
            ];
          }
          return [];
        },
        historyRows: async () => [
          {
            id: "hist_up_1",
            source: "dep_same_1",
            transaction_type: "DEPOSIT",
            amount: 100,
            currency: "USD",
            account_type: "cash",
            posted_at: "2026-09-10T17:00:00+0800",
            balance: 5100,
          },
        ],
        deposits: async () => [
          { deposit_id: "dep_same_1", global_account_id: "ga_1" },
        ],
        globalAccounts: async () => [
          { id: "ga_1", account_number: "8489740082" },
        ],
      },
      sheetsContext: {
        getGoogleDriveAccess: async () => ({ accessToken: "sheet-token" }),
        sheetsRequest: async (_token, path, init) => {
          if (path.includes(":batchUpdate") && init?.body) {
            const parsed = JSON.parse(init.body as string);
            if (parsed.data) {
              writtenBatches.push(...parsed.data);
            }
          }
          return {
            sheets: [
              {
                properties: {
                  sheetId: 123,
                  title: "RAW ngân hàng",
                  gridProperties: { rowCount: 100, columnCount: 22 },
                },
              },
            ],
          };
        },
        readSheet: async () => {
          // If writtenBatches has update for row 2, apply it to sheetData
          const copy = sheetData.map((r) => [...r]);
          for (const batch of writtenBatches) {
            if (batch.range === "'RAW ngân hàng'!N2:Q2") {
              copy[1][13] = batch.values[0][0];
              copy[1][14] = batch.values[0][1];
              copy[1][15] = batch.values[0][2];
              copy[1][16] = batch.values[0][3];
            }
          }
          return copy;
        },
      },
    });

    assert.equal(result.fetched, 1);
    assert.equal(result.updated, 1);
    assert.equal(result.added, 0);

    // Verify written ranges: only N2:Q2 should be written because only description changed!
    // Never J, K, M, R, T!
    assert.equal(writtenBatches.length, 1);
    assert.equal(writtenBatches[0].range, "'RAW ngân hàng'!N2:Q2");
    assert.equal(writtenBatches[0].values[0][2], "New description");

    // Ensure J, K, M, R, T were preserved
    assert.equal(existingRow[9], "Dự án Alpha");
    assert.equal(existingRow[10], "Store Beta");
    assert.equal(existingRow[12], "NB_123");
    assert.equal(existingRow[17], "Row_55");
    assert.equal(existingRow[19], "Ghi chú quan trọng");
  } finally {
    restoreMockAccount();
  }
});

test("9. Xử lý tháng và ngày theo giờ Việt Nam (Asia/Ho_Chi_Minh)", () => {
  // 2026-08-31 18:00 UTC = 2026-09-01 01:00 in Vietnam (UTC+7)
  const utcNearEnd = "2026-08-31T18:00:00Z";
  assert.equal(vietnamDate(utcNearEnd), "2026-09-01");

  // Check windowFor "2026-09"
  const window = monthWindow("2026-09");
  assert.equal(window.from.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(window.to.toISOString(), "2026-09-30T17:00:00.000Z");
});

test("10. So sánh output với snapshot Airwallex đã xác minh (698 dòng tại 30/09/2026, khớp đủ 22 cột)", async () => {
  const fixturePath = path.join(
    __dirname,
    "fixtures/verified-bank-snapshot.json.gz",
  );
  assert.ok(
    fs.existsSync(fixturePath),
    "Fixture verified-bank-snapshot.json.gz phải luôn tồn tại trong repository",
  );

  const fixture = JSON.parse(
    zlib.gunzipSync(fs.readFileSync(fixturePath)).toString("utf8"),
  );
  const expectedRows: Array<{ id: string; values: Array<string | number> }> =
    fixture.expectedRows;
  assert.equal(
    expectedRows.length,
    698,
    "Snapshot đã xác minh phải có đủ 698 dòng",
  );

  const snapshotPath =
    "/Users/tatuanthanh/Downloads/data/airwallex-raw-bank-review-2026-enriched.xlsx";
  const hasExternalExcel = fs.existsSync(snapshotPath);

  let financialRows: RecordValue[] = fixture.inputs.financialRows;
  let historyRowsData: RecordValue[] = fixture.inputs.historyRows;
  let cardTxRows: RecordValue[] = fixture.inputs.cardTxRows;
  let cardsLookupRows: RecordValue[] = fixture.inputs.cardsLookup;
  let depositRowsData: RecordValue[] = fixture.inputs.deposits;
  let paymentRowsData: RecordValue[] = fixture.inputs.payments;

  if (hasExternalExcel) {
    const wb = XLSX.readFile(snapshotPath);
    financialRows = XLSX.utils.sheet_to_json<RecordValue>(
      wb.Sheets["Financial API gốc"],
    );
    historyRowsData = XLSX.utils.sheet_to_json<RecordValue>(
      wb.Sheets["Balance history API"],
    );
    cardTxRows = XLSX.utils.sheet_to_json<RecordValue>(
      wb.Sheets["Issuing legacy API"] ||
        wb.Sheets["Card transactions đối chiếu"],
    );
    cardsLookupRows = XLSX.utils.sheet_to_json<RecordValue>(
      wb.Sheets["Cards lookup"],
    );
    depositRowsData = XLSX.utils.sheet_to_json<RecordValue>(
      wb.Sheets["Deposits API"],
    );
    paymentRowsData = XLSX.utils.sheet_to_json<RecordValue>(
      wb.Sheets["Payments API"],
    );
  }

  setupMockAccount();
  try {
    const rows = await fetchAirwallexBankRows("all", {
      login: async () => "mock-token",
      get: async (_token, reqPath) => {
        if (reqPath === "/api/v1/account") {
          return {
            id: MOCK_ACCOUNT_ID,
            account_details: {
              business_details: { business_name: "MatureX LLC" },
            },
          };
        }
        if (reqPath.startsWith("/api/v1/issuing/cards/")) {
          const cardId = decodeURIComponent(
            reqPath.replace("/api/v1/issuing/cards/", ""),
          );
          const found = cardsLookupRows.find(
            (c) => String(c.card_id) === cardId,
          );
          return found || { card_id: cardId, nick_name: "" };
        }
        if (reqPath.startsWith("/api/v1/payments/")) {
          const pId = decodeURIComponent(
            reqPath.replace("/api/v1/payments/", ""),
          );
          const found = paymentRowsData.find(
            (p) => String(p.payment_id) === pId,
          );
          return found || { payment_id: pId };
        }
        return {};
      },
      numberedPages: async (_token, reqPath) => {
        if (reqPath === "/api/v1/financial_transactions") {
          return financialRows;
        }
        if (reqPath === "/api/v1/issuing/transactions") {
          return cardTxRows;
        }
        return [];
      },
      historyRows: async () => historyRowsData,
      deposits: async () => depositRowsData,
      globalAccounts: async () => [
        {
          id: "8212e730-6983-4940-b4ce-844b662a05f4",
          account_number: "8489740082",
        },
      ],
    });

    assert.equal(
      rows.length,
      698,
      "Tất cả 698 dòng SETTLED trong snapshot phải được phục hồi đầy đủ khi chọn all",
    );

    // Map expected rows by ID
    const expectedById = new Map<
      string,
      { id: string; values: Array<string | number> }
    >(expectedRows.map((r) => [r.id, r]));

    // Verify all 22 columns match for EVERY row
    for (const actualRow of rows) {
      assert.equal(
        actualRow.values.length,
        BANK_HEADERS.length,
        `Dòng ${actualRow.id} phải có đúng 22 cột`,
      );
      const expectedRow = expectedById.get(actualRow.id);
      assert.ok(
        expectedRow,
        `Giao dịch ${actualRow.id} không tìm thấy trong expected snapshot`,
      );
      const values = expectedRow.values;

      for (let col = 0; col < BANK_HEADERS.length; col++) {
        const actualVal = actualRow.values[col];
        const expectedVal = values[col];
        const headerName = BANK_HEADERS[col];

        if (typeof expectedVal === "number") {
          const actualNum = Number(actualVal);
          assert.ok(
            Math.abs(actualNum - expectedVal) < 0.001,
            `Dòng ${actualRow.id} cột [${col}] ${headerName}: mong đợi ${expectedVal}, nhận được ${actualVal}`,
          );
        } else {
          assert.equal(
            String(actualVal ?? "").trim(),
            String(expectedVal ?? "").trim(),
            `Dòng ${actualRow.id} cột [${col}] ${headerName}: mong đợi "${expectedVal}", nhận được "${actualVal}"`,
          );
        }
      }
    }
  } finally {
    restoreMockAccount();
  }
});

test("11. Xử lý ranh giới tháng: SETTLED ngày 30/09 nhưng posted_at là 01/10", async () => {
  setupMockAccount();
  try {
    const septSettledDate = "2026-09-30T15:00:00.000Z";
    const octPostedDate = "2026-10-01T08:05:00+0800";

    const mockFinancial = [
      {
        id: "ftx_boundary_sept_to_oct",
        status: "SETTLED",
        currency: "USD",
        transaction_type: "DEPOSIT",
        net: 1200,
        created_at: "2026-09-30T14:00:00.000Z",
        settled_at: septSettledDate,
        source_id: "dep_boundary",
      },
    ];

    const mockHistory = [
      {
        id: "hist_boundary_oct",
        source: "dep_boundary",
        transaction_type: "DEPOSIT",
        amount: 1200,
        currency: "USD",
        account_type: "cash",
        posted_at: octPostedDate,
        balance: 50000,
      },
    ];

    // Case 1: Sync tháng 09 (2026-09)
    // Transaction settled 30/09 nhưng posted 01/10 không được gây lỗi, mà phải bỏ qua để chuyển sang tháng 10
    const septRows = await fetchAirwallexBankRows("2026-09", {
      login: async () => "mock-token",
      get: async (_token, path) => {
        if (path === "/api/v1/account") {
          return {
            id: MOCK_ACCOUNT_ID,
            account_details: {
              business_details: { business_name: "MatureX LLC" },
            },
          };
        }
        return {};
      },
      numberedPages: async (_token, path) => {
        if (path === "/api/v1/financial_transactions") return mockFinancial;
        return [];
      },
      historyRows: async () => mockHistory,
      deposits: async () => [
        { deposit_id: "dep_boundary", global_account_id: "ga_b" },
      ],
      globalAccounts: async () => [
        { id: "ga_b", account_number: "8489740082" },
      ],
    });

    assert.equal(
      septRows.length,
      0,
      "Sync tháng 09 phải không lấy giao dịch posted tháng 10 và không được ném lỗi",
    );

    // Case 2: Sync tháng 10 (2026-10)
    // Transaction settled 30/09 và posted 01/10 phải được sync vào tháng 10
    const octRows = await fetchAirwallexBankRows("2026-10", {
      login: async () => "mock-token",
      get: async (_token, path) => {
        if (path === "/api/v1/account") {
          return {
            id: MOCK_ACCOUNT_ID,
            account_details: {
              business_details: { business_name: "MatureX LLC" },
            },
          };
        }
        return {};
      },
      numberedPages: async (_token, path) => {
        if (path === "/api/v1/financial_transactions") return mockFinancial;
        return [];
      },
      historyRows: async () => mockHistory,
      deposits: async () => [
        { deposit_id: "dep_boundary", global_account_id: "ga_b" },
      ],
      globalAccounts: async () => [
        { id: "ga_b", account_number: "8489740082" },
      ],
    });

    assert.equal(octRows.length, 1);
    assert.equal(octRows[0].id, "ftx_boundary_sept_to_oct");
    assert.equal(octRows[0].values[0], "2026-10-01");
    assert.equal(octRows[0].values[1], octPostedDate);
    assert.equal(octRows[0].values[8], 50000);

    // Case 3: Giao dịch SETTLED giữa tháng (15/09) hoàn toàn không có balance history thì phải ném lỗi
    await assert.rejects(
      fetchAirwallexBankRows("2026-09", {
        login: async () => "mock-token",
        get: async (_token, path) => {
          if (path === "/api/v1/account") {
            return {
              id: MOCK_ACCOUNT_ID,
              account_details: {
                business_details: { business_name: "MatureX LLC" },
              },
            };
          }
          return {};
        },
        numberedPages: async (_token, path) => {
          if (path === "/api/v1/financial_transactions") {
            return [
              {
                id: "ftx_mid_month_orphan",
                status: "SETTLED",
                currency: "USD",
                transaction_type: "DEPOSIT",
                net: 800,
                created_at: "2026-09-15T10:00:00.000Z",
                settled_at: "2026-09-15T12:00:00.000Z",
                source_id: "dep_orphan",
              },
            ];
          }
          return [];
        },
        historyRows: async () => [],
      }),
      /Không ghép được balance history cho financial transaction ftx_mid_month_orphan/,
    );

    // Case 4: Giao dịch SETTLED sát cuối tháng (30/09 lúc 23:30 ICT = 16:30 UTC) nhưng hoàn toàn KHÔNG có balance history ở đâu cả
    // Tuyệt đối không được âm thầm bỏ qua, phải ném lỗi
    await assert.rejects(
      fetchAirwallexBankRows("2026-09", {
        login: async () => "mock-token",
        get: async (_token, path) => {
          if (path === "/api/v1/account") {
            return {
              id: MOCK_ACCOUNT_ID,
              account_details: {
                business_details: { business_name: "MatureX LLC" },
              },
            };
          }
          return {};
        },
        numberedPages: async (_token, path) => {
          if (path === "/api/v1/financial_transactions") {
            return [
              {
                id: "ftx_end_of_month_missing_history",
                status: "SETTLED",
                currency: "USD",
                transaction_type: "DEPOSIT",
                net: 950,
                created_at: "2026-09-30T16:20:00.000Z",
                settled_at: "2026-09-30T16:30:00.000Z", // 23:30 ICT ngày 30/09 (cách mốc chuyển tháng chỉ 30 phút)
                source_id: "dep_missing_30",
              },
            ];
          }
          return [];
        },
        historyRows: async () => [],
      }),
      /Không ghép được balance history cho financial transaction ftx_end_of_month_missing_history/,
    );
  } finally {
    restoreMockAccount();
  }
});

test("12. Tối ưu hóa API Deposits: không quét vô cớ từ 01/01 và bỏ qua khi không có deposit", async () => {
  setupMockAccount();
  try {
    let depositCallCount = 0;
    let queriedDateWindow: { from: Date; to: Date } | null = null;

    // Subtest A: Giao dịch PAYOUT (có source_id nhưng không phải DEPOSIT) -> KHÔNG gọi deposits API
    await fetchAirwallexBankRows("2026-09", {
      login: async () => "mock-token",
      get: async (_token, path) => {
        if (path === "/api/v1/account") {
          return {
            id: MOCK_ACCOUNT_ID,
            account_details: {
              business_details: { business_name: "MatureX LLC" },
            },
          };
        }
        if (path.startsWith("/api/v1/payments/")) {
          return { payment_id: "pay_123" };
        }
        return {};
      },
      numberedPages: async (_token, path) => {
        if (path === "/api/v1/financial_transactions") {
          return [
            {
              id: "ftx_payout",
              status: "SETTLED",
              currency: "USD",
              transaction_type: "PAYOUT",
              net: -300,
              created_at: "2026-09-10T10:00:00.000Z",
              settled_at: "2026-09-10T11:00:00.000Z",
              source_id: "pay_123",
            },
          ];
        }
        return [];
      },
      historyRows: async () => [
        {
          id: "hist_payout",
          source: "pay_123",
          transaction_type: "PAYOUT",
          amount: -300,
          currency: "USD",
          account_type: "cash",
          posted_at: "2026-09-10T18:00:00+0800",
          balance: 20000,
        },
      ],
      deposits: async () => {
        depositCallCount++;
        return [];
      },
    });

    assert.equal(
      depositCallCount,
      0,
      "Giao dịch PAYOUT có source_id nhưng không phải DEPOSIT thì tuyệt đối không được gọi API deposits",
    );

    // Subtest B: Có giao dịch DEPOSIT trong tháng 9 -> chỉ quét phạm vi quanh ngày giao dịch, không quét từ 01/01
    await fetchAirwallexBankRows("2026-09", {
      login: async () => "mock-token",
      get: async (_token, path) => {
        if (path === "/api/v1/account") {
          return {
            id: MOCK_ACCOUNT_ID,
            account_details: {
              business_details: { business_name: "MatureX LLC" },
            },
          };
        }
        return {};
      },
      numberedPages: async (_token, path) => {
        if (path === "/api/v1/financial_transactions") {
          return [
            {
              id: "ftx_dep",
              status: "SETTLED",
              currency: "USD",
              transaction_type: "DEPOSIT",
              net: 500,
              created_at: "2026-09-15T10:00:00.000Z",
              settled_at: "2026-09-15T11:00:00.000Z",
              source_id: "dep_target",
            },
          ];
        }
        return [];
      },
      historyRows: async () => [
        {
          id: "hist_dep",
          source: "dep_target",
          transaction_type: "DEPOSIT",
          amount: 500,
          currency: "USD",
          account_type: "cash",
          posted_at: "2026-09-15T18:00:00+0800",
          balance: 20500,
        },
      ],
      deposits: async (_token, toOrRange) => {
        depositCallCount++;
        queriedDateWindow = toOrRange as { from: Date; to: Date };
        return [{ deposit_id: "dep_target", global_account_id: "ga_target" }];
      },
      globalAccounts: async () => [
        { id: "ga_target", account_number: "8489740082" },
      ],
    });

    assert.equal(depositCallCount, 1);
    assert.ok(
      queriedDateWindow && typeof queriedDateWindow === "object",
      "deposits phải nhận DateWindow khi sync theo tháng",
    );
    // created_at là 2026-09-15, buffer 7 ngày -> from khoảng 2026-09-08, KHÔNG PHẢI 2026-01-01
    const fromTime = (
      queriedDateWindow as { from: Date; to: Date }
    ).from.getTime();
    const septStart = new Date("2026-09-01T00:00:00+07:00").getTime();
    assert.ok(
      fromTime >= septStart - 7 * 24 * 60 * 60 * 1000,
      `Phạm vi quét deposit phải bắt đầu quanh ngày giao dịch (khoảng tháng 9), nhưng nhận được: ${(queriedDateWindow as { from: Date; to: Date }).from.toISOString()}`,
    );
  } finally {
    restoreMockAccount();
  }
});
