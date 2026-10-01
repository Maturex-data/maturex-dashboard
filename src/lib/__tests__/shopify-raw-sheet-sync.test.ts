import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractPayoutDateRangeCache,
  fetchOrders,
  GRAPHQL_ORDER_BATCH_SIZE,
  HEADERS,
  isDateCoveredByRange,
  isValidTransactionDateRange,
  preflightGoogleSheet,
  type SheetValue,
  type ShopifyPayout,
  type ShopifySyncContext,
  type ShopifyTransaction,
  syncShopifyRawMonthToSheet,
} from "../shopify-raw-sheet-sync";

function createMockResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function setupMockEnv() {
  process.env.SHOPIFY_STORE_DOMAIN = "test-store.myshopify.com";
  process.env.SHOPIFY_ACCESS_TOKEN = "shpat_test_token_123";
  process.env.SHOPIFY_API_VERSION = "2026-07";
  process.env.EC_SHOPIFY_RAW_STORE_NAME = "The Deerly";
}

test("isValidTransactionDateRange: kiểm tra định dạng ngày và khoảng ngày", () => {
  // Hợp lệ
  assert.equal(isValidTransactionDateRange("2026-09-01"), true);
  assert.equal(isValidTransactionDateRange("2026-08-30 - 2026-09-02"), true);
  assert.equal(
    isValidTransactionDateRange("2026-08-10, 2026-08-15 - 2026-08-18"),
    true,
  );
  assert.equal(
    isValidTransactionDateRange(
      "2026-08-01 - 2026-08-03, 2026-08-05 - 2026-08-07, 2026-08-10",
    ),
    true,
  );

  // Không hợp lệ
  assert.equal(isValidTransactionDateRange(""), false);
  assert.equal(isValidTransactionDateRange("   "), false);
  assert.equal(isValidTransactionDateRange(null), false);
  assert.equal(isValidTransactionDateRange(undefined), false);
  assert.equal(isValidTransactionDateRange("not-a-date"), false);
  assert.equal(isValidTransactionDateRange("2026/09/01"), false);
  assert.equal(isValidTransactionDateRange("2026-02-30"), false); // Tháng 2 không có ngày 30
  assert.equal(isValidTransactionDateRange("2026-09-31"), false); // Tháng 9 chỉ có 30 ngày
  assert.equal(isValidTransactionDateRange("2026-08-30 - 2026-08-10"), false); // Ngày bắt đầu > ngày kết thúc
  assert.equal(isValidTransactionDateRange("2026-08-10 - 2026-08-10"), false); // Trùng ngày không dùng dạng khoảng
  assert.equal(
    isValidTransactionDateRange("2026-08-15, 2026-08-10 - 2026-08-12"),
    false,
  ); // Thứ tự ngày bị lùi
});

test("Pre-flight: thành công khi đọc đúng 25 cột header A1:Y1, kiểm tra quyền edit Drive và tab metadata hoàn toàn zero-mutation", async () => {
  const calledMethods: string[] = [];
  const calledPaths: string[] = [];

  const mockGoogleRequest = async (
    _token: string,
    path: string,
    init?: RequestInit,
  ) => {
    calledMethods.push(init?.method || "GET");
    calledPaths.push(path);
    const decoded = decodeURIComponent(path);

    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: true, canModifyContent: true },
      });
    }
    if (decoded.includes("fields=sheets")) {
      return createMockResponse({
        sheets: [
          {
            properties: { sheetId: 0, title: "RAW sàn" },
            protectedRanges: [],
          },
        ],
      });
    }
    if (decoded.includes("A1:Y1")) {
      return createMockResponse({
        values: [[...HEADERS]],
      });
    }
    return createMockResponse({});
  };

  const headers = await preflightGoogleSheet("mock-token", mockGoogleRequest);
  assert.equal(headers.length, 25);
  assert.deepEqual(headers, [...HEADERS]);

  // Xác nhận zero-mutation: TẤT CẢ các request trong preflight đều là GET, không có PUT hay POST
  assert.equal(calledMethods.length, 3);
  assert.ok(
    calledMethods.every((m) => m === "GET"),
    "Pre-flight phải là pure GET, zero-mutation (không tạo version history hay ghi đè công thức)",
  );
  assert.ok(calledPaths.some((p) => p.includes("capabilities(canEdit")));
  assert.ok(calledPaths.some((p) => p.includes("fields=sheets")));
  assert.ok(calledPaths.some((p) => p.includes("A1%3AY1")));
});

test("Pre-flight: thất bại khi Google Drive capabilities canEdit = false và KHÔNG gọi Shopify", async () => {
  setupMockEnv();
  const shopifyCalls: string[] = [];
  const mockShopifyFetch: typeof fetch = async (input) => {
    shopifyCalls.push(String(input));
    return createMockResponse({});
  };

  const mockGoogleRequest = async (_token: string, path: string) => {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: false, canModifyContent: true },
      });
    }
    return createMockResponse({});
  };

  const context: ShopifySyncContext = {
    getGoogleDriveAccess: async () => ({ accessToken: "mock-token" }),
    googleRequest: mockGoogleRequest,
    shopifyFetch: mockShopifyFetch,
  };

  await assert.rejects(async () => {
    await syncShopifyRawMonthToSheet("2026-09", context);
  }, /canEdit: false/i);

  assert.equal(
    shopifyCalls.length,
    0,
    "Shopify API TUYỆT ĐỐI không được gọi khi tài khoản chỉ là Viewer/Commenter",
  );
});

test("Pre-flight: thất bại khi Google Drive canModifyContent = false dù canEdit = true và KHÔNG gọi Shopify", async () => {
  setupMockEnv();
  const shopifyCalls: string[] = [];
  const mockShopifyFetch: typeof fetch = async (input) => {
    shopifyCalls.push(String(input));
    return createMockResponse({});
  };

  const mockGoogleRequest = async (_token: string, path: string) => {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: true, canModifyContent: false },
      });
    }
    return createMockResponse({});
  };

  const context: ShopifySyncContext = {
    getGoogleDriveAccess: async () => ({ accessToken: "mock-token" }),
    googleRequest: mockGoogleRequest,
    shopifyFetch: mockShopifyFetch,
  };

  await assert.rejects(async () => {
    await syncShopifyRawMonthToSheet("2026-09", context);
  }, /canModifyContent: false/i);

  assert.equal(shopifyCalls.length, 0);
});

test("Pre-flight: thất bại khi tab metadata có protected range khóa dữ liệu (requestingUserCanEdit = false) và KHÔNG gọi Shopify", async () => {
  setupMockEnv();
  const shopifyCalls: string[] = [];
  const mockShopifyFetch: typeof fetch = async (input) => {
    shopifyCalls.push(String(input));
    return createMockResponse({});
  };

  const mockGoogleRequest = async (_token: string, path: string) => {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: true, canModifyContent: true },
      });
    }
    if (decoded.includes("fields=sheets")) {
      return createMockResponse({
        sheets: [
          {
            properties: { sheetId: 0, title: "RAW sàn" },
            protectedRanges: [
              {
                // Khóa từ hàng 2 trở đi trên các cột A:Y
                range: {
                  sheetId: 0,
                  startRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 25,
                },
                requestingUserCanEdit: false,
              },
            ],
          },
        ],
      });
    }
    return createMockResponse({});
  };

  const context: ShopifySyncContext = {
    getGoogleDriveAccess: async () => ({ accessToken: "mock-token" }),
    googleRequest: mockGoogleRequest,
    shopifyFetch: mockShopifyFetch,
  };

  await assert.rejects(async () => {
    await syncShopifyRawMonthToSheet("2026-09", context);
  }, /vùng bảo vệ không cho phép chỉnh sửa dữ liệu A2:Y/i);

  assert.equal(shopifyCalls.length, 0);
});

test("Pre-flight: thành công khi chỉ bảo vệ hàng tiêu đề A1:Y1 nhưng cho phép chỉnh sửa vùng dữ liệu A2:Y", async () => {
  const mockGoogleRequest = async (_token: string, path: string) => {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: true, canModifyContent: true },
      });
    }
    if (decoded.includes("fields=sheets")) {
      return createMockResponse({
        sheets: [
          {
            properties: { sheetId: 0, title: "RAW sàn" },
            protectedRanges: [
              {
                // Chỉ bảo vệ duy nhất hàng 1 (A1:Y1, startRowIndex: 0, endRowIndex: 1)
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 25,
                },
                requestingUserCanEdit: false,
              },
            ],
          },
        ],
      });
    }
    if (decoded.includes("A1:Y1")) {
      return createMockResponse({
        values: [[...HEADERS]],
      });
    }
    return createMockResponse({});
  };

  const headers = await preflightGoogleSheet("mock-token", mockGoogleRequest);
  assert.equal(headers.length, 25);
  assert.deepEqual(headers, [...HEADERS]);
});

test("Pre-flight: thành công khi protected range nằm ngoài cột A:Y (ví dụ cột Z trở đi) hoặc warningOnly = true", async () => {
  const mockGoogleRequest = async (_token: string, path: string) => {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: true, canModifyContent: true },
      });
    }
    if (decoded.includes("fields=sheets")) {
      return createMockResponse({
        sheets: [
          {
            properties: { sheetId: 0, title: "RAW sàn" },
            protectedRanges: [
              {
                // Khóa cột Z trở đi (startColumnIndex: 25)
                range: {
                  sheetId: 0,
                  startRowIndex: 1,
                  startColumnIndex: 25,
                },
                requestingUserCanEdit: false,
                warningOnly: false,
              },
              {
                // Khóa hàng 2 nhưng warningOnly = true
                range: {
                  sheetId: 0,
                  startRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 25,
                },
                requestingUserCanEdit: false,
                warningOnly: true,
              },
            ],
          },
        ],
      });
    }
    if (decoded.includes("A1:Y1")) {
      return createMockResponse({
        values: [[...HEADERS]],
      });
    }
    return createMockResponse({});
  };

  const headers = await preflightGoogleSheet("mock-token", mockGoogleRequest);
  assert.equal(headers.length, 25);
  assert.deepEqual(headers, [...HEADERS]);
});

test("Pre-flight: thành công khi protected sheet có unprotectedRanges bao phủ vùng dữ liệu A2:Y", async () => {
  const mockGoogleRequest = async (_token: string, path: string) => {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: true, canModifyContent: true },
      });
    }
    if (decoded.includes("fields=sheets")) {
      return createMockResponse({
        sheets: [
          {
            properties: { sheetId: 0, title: "RAW sàn" },
            protectedRanges: [
              {
                // Khóa toàn bộ sheet
                range: { sheetId: 0 },
                requestingUserCanEdit: false,
                warningOnly: false,
                unprotectedRanges: [
                  // Nhưng mở khóa cho toàn bộ vùng dữ liệu A2:Y
                  {
                    sheetId: 0,
                    startRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 25,
                  },
                ],
              },
            ],
          },
        ],
      });
    }
    if (decoded.includes("A1:Y1")) {
      return createMockResponse({
        values: [[...HEADERS]],
      });
    }
    return createMockResponse({});
  };

  const headers = await preflightGoogleSheet("mock-token", mockGoogleRequest);
  assert.equal(headers.length, 25);
  assert.deepEqual(headers, [...HEADERS]);
});

test("Pre-flight: thất bại khi thiếu cột hoặc sai tên cột header và KHÔNG gọi Shopify", async () => {
  setupMockEnv();
  const shopifyCalls: string[] = [];
  const mockShopifyFetch: typeof fetch = async (input) => {
    shopifyCalls.push(String(input));
    return createMockResponse({});
  };

  const createHeaderRequest =
    (headers: unknown[]) => async (_token: string, path: string) => {
      const decoded = decodeURIComponent(path);
      if (decoded.includes("capabilities(canEdit")) {
        return createMockResponse({
          capabilities: { canEdit: true, canModifyContent: true },
        });
      }
      if (decoded.includes("fields=sheets")) {
        return createMockResponse({
          sheets: [
            {
              properties: { sheetId: 0, title: "RAW sàn" },
              protectedRanges: [],
            },
          ],
        });
      }
      if (decoded.includes("A1:Y1")) {
        return createMockResponse({ values: [headers] });
      }
      return createMockResponse({});
    };

  // Case 1: Thiếu cột (chỉ 24 cột)
  const contextMissingCol: ShopifySyncContext = {
    getGoogleDriveAccess: async () => ({ accessToken: "mock-token" }),
    googleRequest: createHeaderRequest(HEADERS.slice(0, 24)),
    shopifyFetch: mockShopifyFetch,
  };

  await assert.rejects(async () => {
    await syncShopifyRawMonthToSheet("2026-09", contextMissingCol);
  }, /không đủ 25 cột/i);
  assert.equal(shopifyCalls.length, 0);

  // Case 2: Sai tên cột (cột 3 sai tên)
  const corruptedHeaders: string[] = [...HEADERS];
  corruptedHeaders[2] = "Tên dự án sai";
  const contextWrongCol: ShopifySyncContext = {
    getGoogleDriveAccess: async () => ({ accessToken: "mock-token" }),
    googleRequest: createHeaderRequest(corruptedHeaders),
    shopifyFetch: mockShopifyFetch,
  };

  await assert.rejects(async () => {
    await syncShopifyRawMonthToSheet("2026-09", contextWrongCol);
  }, /sai ở cột 3/i);
  assert.equal(shopifyCalls.length, 0);
});

test("Batch Orders: dùng tối đa 250 IDs, xử lý chunk cuối và deduplicate order IDs", async () => {
  setupMockEnv();
  const requestedChunks: string[][] = [];

  // Giả lập 505 transactions:
  // - 100 transactions trùng order_1
  // - 100 transactions trùng order_2
  // - 503 order IDs riêng biệt (từ 3 đến 505)
  // Tổng order IDs phân biệt: 505 IDs.
  // Với batch 250:
  // Chunk 1: 250 IDs
  // Chunk 2: 250 IDs
  // Chunk 3: 5 IDs (chunk cuối)
  const transactions: ShopifyTransaction[] = [];
  for (let i = 0; i < 100; i += 1) {
    transactions.push({ source_order_id: "order_1" });
  }
  for (let i = 0; i < 100; i += 1) {
    transactions.push({ source_order_id: "order_2" });
  }
  for (let i = 3; i <= 505; i += 1) {
    transactions.push({ source_order_id: `order_${i}` });
  }

  const mockShopifyFetch: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      variables: { ids: string[] };
    };
    requestedChunks.push(body.variables.ids);

    const nodes = body.variables.ids.map((gid) => {
      const numId = gid.split("/").at(-1);
      return {
        id: gid,
        name: `#ORDER-${numId}`,
        currentTotalTaxSet: { shopMoney: { amount: "5.00" } },
      };
    });

    return createMockResponse({
      data: { nodes },
    });
  };

  const orders = await fetchOrders(transactions, mockShopifyFetch);

  assert.equal(GRAPHQL_ORDER_BATCH_SIZE, 250);
  assert.equal(requestedChunks.length, 3, "Phải chia thành đúng 3 chunks");
  assert.equal(requestedChunks[0].length, 250, "Chunk 1 phải có đúng 250 IDs");
  assert.equal(requestedChunks[1].length, 250, "Chunk 2 phải có đúng 250 IDs");
  assert.equal(
    requestedChunks[2].length,
    5,
    "Chunk 3 (cuối) phải có đúng 5 IDs",
  );
  assert.equal(
    orders.size,
    505,
    "Deduplicate chuẩn xác 505 orders phân biệt từ 703 transactions",
  );
  assert.equal(orders.get("order_1")?.name, "#ORDER-order_1");
  assert.equal(orders.get("order_505")?.name, "#ORDER-order_505");
});

test("Batch Orders: xử lý throttle và retry thành công", async () => {
  setupMockEnv();
  let callCount = 0;

  const transactions: ShopifyTransaction[] = [
    { source_order_id: "ord_throttle_1" },
  ];

  const mockShopifyFetch: typeof fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      // Lần 1: Trả về GraphQL THROTTLED error
      return createMockResponse({
        errors: [
          {
            message: "Throttled",
            extensions: { code: "THROTTLED" },
          },
        ],
        extensions: {
          cost: {
            throttleStatus: {
              maximumAvailable: 1000,
              currentlyAvailable: 200,
              restoreRate: 100,
            },
          },
        },
      });
    }

    // Lần 2: Thành công
    return createMockResponse({
      data: {
        nodes: [
          {
            id: "gid://shopify/Order/ord_throttle_1",
            name: "#DEER-1001",
            currentTotalTaxSet: { shopMoney: { amount: "2.50" } },
          },
        ],
      },
    });
  };

  const orders = await fetchOrders(transactions, mockShopifyFetch);
  assert.equal(callCount, 2, "Phải retry sau khi bị throttled");
  assert.equal(orders.get("ord_throttle_1")?.name, "#DEER-1001");
});

test("Cache payout: tái sử dụng cache khi payout paid và dòng sheet nhất quán", () => {
  const payouts = new Map<string, ShopifyPayout>([
    ["po_paid_1", { id: "po_paid_1", status: "paid" }],
    ["po_paid_2", { id: "po_paid_2", status: "Paid" }], // Case-insensitive
  ]);

  const existingRows: unknown[][] = [
    [...HEADERS], // Header
    [
      "2026-09-01 10:00",
      "2026-08-30 - 2026-09-02",
      "",
      "",
      "",
      "",
      "",
      "",
      "po_paid_1",
    ],
    [
      "2026-09-02 11:00",
      "2026-08-30 - 2026-09-02",
      "",
      "",
      "",
      "",
      "",
      "",
      "po_paid_1",
    ],
    ["2026-09-05 12:00", "2026-09-05", "", "", "", "", "", "", "po_paid_2"],
  ];

  const cache = extractPayoutDateRangeCache(existingRows, payouts);
  assert.equal(cache.size, 2);
  assert.equal(cache.get("po_paid_1"), "2026-08-30 - 2026-09-02");
  assert.equal(cache.get("po_paid_2"), "2026-09-05");
});

test("Cache payout: từ chối cache khi payout chưa paid (pending/in_transit)", () => {
  const payouts = new Map<string, ShopifyPayout>([
    ["po_pending", { id: "po_pending", status: "pending" }],
    ["po_in_transit", { id: "po_in_transit", status: "in_transit" }],
    ["po_paid", { id: "po_paid", status: "paid" }],
  ]);

  const existingRows: unknown[][] = [
    [...HEADERS],
    ["2026-09-01", "2026-09-01", "", "", "", "", "", "", "po_pending"],
    [
      "2026-09-02",
      "2026-09-01 - 2026-09-02",
      "",
      "",
      "",
      "",
      "",
      "",
      "po_in_transit",
    ],
    ["2026-09-03", "2026-09-03", "", "", "", "", "", "", "po_paid"],
  ];

  const cache = extractPayoutDateRangeCache(existingRows, payouts);
  assert.equal(cache.size, 1);
  assert.equal(cache.has("po_pending"), false, "Không cache payout pending");
  assert.equal(
    cache.has("po_in_transit"),
    false,
    "Không cache payout in_transit",
  );
  assert.equal(cache.get("po_paid"), "2026-09-03");
});

test("Cache payout: từ chối cache khi các dòng của cùng payout bị mâu thuẫn hoặc rỗng", () => {
  const payouts = new Map<string, ShopifyPayout>([
    ["po_conflict", { id: "po_conflict", status: "paid" }],
    ["po_has_empty", { id: "po_has_empty", status: "paid" }],
    ["po_invalid_date", { id: "po_invalid_date", status: "paid" }],
  ]);

  const existingRows: unknown[][] = [
    [...HEADERS],
    // po_conflict: dòng 1 có range khác dòng 2
    [
      "2026-09-01",
      "2026-09-01 - 2026-09-02",
      "",
      "",
      "",
      "",
      "",
      "",
      "po_conflict",
    ],
    [
      "2026-09-02",
      "2026-09-01 - 2026-09-03",
      "",
      "",
      "",
      "",
      "",
      "",
      "po_conflict",
    ],

    // po_has_empty: dòng 1 có range, dòng 2 rỗng
    ["2026-09-01", "2026-09-01", "", "", "", "", "", "", "po_has_empty"],
    ["2026-09-02", "", "", "", "", "", "", "", "po_has_empty"],

    // po_invalid_date: giá trị ngày không hợp lệ
    ["2026-09-01", "invalid-range", "", "", "", "", "", "", "po_invalid_date"],
  ];

  const cache = extractPayoutDateRangeCache(existingRows, payouts);
  assert.equal(
    cache.size,
    0,
    "Tất cả các trường hợp bất thường đều phải từ chối cache để fallback API",
  );
});

test("Sync hoàn chỉnh: Payout paid có cache thì không gọi API, payout uncached/pending thì gọi API fallback và lấy đủ ngày vắt tháng", async () => {
  setupMockEnv();
  const shopifyCalls: string[] = [];

  // Month: 2026-09
  // 3 transactions:
  // - tx_1 thuộc po_paid_cached (đã có trên sheet với range '2026-08-30 - 2026-09-02')
  // - tx_2 thuộc po_cross_month_uncached (chưa có trên sheet; API trả 2 transactions: 2026-08-31 và 2026-09-01)
  // - tx_3 thuộc po_pending (đã có trên sheet nhưng status pending nên phải gọi API)
  const monthTransactions = [
    {
      id: "tx_1",
      type: "charge",
      processed_at: "2026-09-01T08:00:00.000Z",
      currency: "USD",
      amount: "100.00",
      fee: "3.20",
      net: "96.80",
      payout_id: "po_paid_cached",
      payout_status: "paid",
      source_order_id: "ord_1",
    },
    {
      id: "tx_2",
      type: "charge",
      processed_at: "2026-09-01T09:00:00.000Z",
      currency: "USD",
      amount: "50.00",
      fee: "1.75",
      net: "48.25",
      payout_id: "po_cross_month_uncached",
      payout_status: "paid",
      source_order_id: "ord_2",
    },
    {
      id: "tx_3",
      type: "charge",
      processed_at: "2026-09-02T10:00:00.000Z",
      currency: "USD",
      amount: "80.00",
      fee: "2.60",
      net: "77.40",
      payout_id: "po_pending",
      payout_status: "pending",
      source_order_id: "ord_3",
    },
  ];

  const payoutsList = [
    { id: "po_paid_cached", status: "paid", date: "2026-09-04" },
    { id: "po_cross_month_uncached", status: "paid", date: "2026-09-05" },
    { id: "po_pending", status: "pending", date: "2026-09-06" },
  ];

  const mockShopifyFetch: typeof fetch = async (input) => {
    const url = String(input);
    shopifyCalls.push(url);

    if (url.includes("processed_at_min")) {
      return createMockResponse({ transactions: monthTransactions });
    }
    if (url.includes("payouts.json")) {
      return createMockResponse({ payouts: payoutsList });
    }
    if (url.includes("graphql.json")) {
      return createMockResponse({
        data: {
          nodes: [
            {
              id: "gid://shopify/Order/ord_1",
              name: "#DEER-1",
              currentTotalTaxSet: { shopMoney: { amount: "0.00" } },
            },
            {
              id: "gid://shopify/Order/ord_2",
              name: "#DEER-2",
              currentTotalTaxSet: { shopMoney: { amount: "0.00" } },
            },
            {
              id: "gid://shopify/Order/ord_3",
              name: "#DEER-3",
              currentTotalTaxSet: { shopMoney: { amount: "0.00" } },
            },
          ],
        },
      });
    }

    // Payout transactions query:
    if (url.includes("payout_id=po_cross_month_uncached")) {
      // Vắt tháng: có giao dịch ngày 31/08 và 01/09
      return createMockResponse({
        transactions: [
          {
            type: "charge",
            processed_at: "2026-08-31T20:00:00+07:00", // 31/08 ICT
          },
          {
            type: "charge",
            processed_at: "2026-09-01T10:00:00+07:00", // 01/09 ICT
          },
        ],
      });
    }

    if (url.includes("payout_id=po_pending")) {
      return createMockResponse({
        transactions: [
          {
            type: "charge",
            processed_at: "2026-09-02T10:00:00+07:00",
          },
        ],
      });
    }

    if (url.includes("payout_id=po_paid_cached")) {
      assert.fail(
        "KHÔNG ĐƯỢC GỌI API cho po_paid_cached vì đã có cache hợp lệ!",
      );
    }

    return createMockResponse({});
  };

  // Google sheet ban đầu:
  // - Hàng 1: Header
  // - Hàng 2: một dòng cũ của po_paid_cached có cột B = '2026-08-30 - 2026-09-02'
  let writtenBatchData: { range: string; values: SheetValue[][] }[] = [];

  const mockGoogleRequest = async (
    _token: string,
    path: string,
    init?: RequestInit,
  ) => {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: true, canModifyContent: true },
      });
    }
    if (decoded.includes("fields=sheets")) {
      return createMockResponse({
        sheets: [
          { properties: { sheetId: 0, title: "RAW sàn" }, protectedRanges: [] },
        ],
      });
    }
    if (decoded.includes("A1:Y1")) {
      // Pre-flight
      return createMockResponse({ values: [[...HEADERS]] });
    }
    if (decoded.includes("A1:Y")) {
      // Read existing sheet rows for cache
      return createMockResponse({
        values: [
          [...HEADERS],
          [
            "2026-08-31 22:00",
            "2026-08-30 - 2026-09-02",
            "",
            "The Deerly",
            "Shopify Payments",
            "",
            "USD",
            "#DEER-OLD",
            "po_paid_cached",
            "charge",
            "paid",
            "Đã thanh toán",
            100,
            3,
            "",
            "",
            "",
            97,
            "",
            "2026-09-04",
            "",
            "",
            "",
            "Shopify Payments",
            "2026-08-31 23:00",
          ],
          [
            "2026-08-31 20:00",
            "2026-08-31", // Dòng cũ tháng 8 chỉ có 1 ngày này, range cũ chưa hoàn chỉnh
            "",
            "The Deerly",
            "Shopify Payments",
            "",
            "USD",
            "#DEER-OLD-CROSS",
            "po_cross_month_uncached",
            "charge",
            "paid",
            "Đã thanh toán",
            50,
            1.75,
            "",
            "",
            "",
            48.25,
            "",
            "2026-09-05",
            "",
            "",
            "",
            "Shopify Payments",
            "2026-08-31 23:00",
          ],
        ],
      });
    }
    if (path.includes("batchUpdate")) {
      const body = JSON.parse(String(init?.body)) as {
        data: { range: string; values: SheetValue[][] }[];
      };
      writtenBatchData = body.data;
      return createMockResponse({});
    }
    if (decoded.includes("A2:Y")) {
      // Verification read
      return createMockResponse({
        values: writtenBatchData[0]?.values ?? [],
      });
    }
    return createMockResponse({});
  };

  const context: ShopifySyncContext = {
    getGoogleDriveAccess: async () => ({ accessToken: "mock-google-token" }),
    googleRequest: mockGoogleRequest,
    shopifyFetch: mockShopifyFetch,
    now: () => "2026-09-02T15:00:00.000Z",
  };

  const result = await syncShopifyRawMonthToSheet("2026-09", context);
  assert.equal(result.rowsWritten, 3);

  // Xác minh không gọi API cho po_paid_cached
  assert.ok(
    !shopifyCalls.some((call) => call.includes("payout_id=po_paid_cached")),
    "API payout_id=po_paid_cached không bị gọi",
  );

  // Xác minh có gọi API cho po_cross_month_uncached và po_pending
  assert.ok(
    shopifyCalls.some((call) =>
      call.includes("payout_id=po_cross_month_uncached"),
    ),
    "Phải gọi API cho po_cross_month_uncached",
  );
  assert.ok(
    shopifyCalls.some((call) => call.includes("payout_id=po_pending")),
    "Phải gọi API cho po_pending vì trạng thái chưa paid",
  );

  // Kiểm tra dữ liệu được ghi lên Google Sheet:
  const writtenRows = writtenBatchData[0].values;
  assert.equal(writtenRows.length, 5); // 2 dòng cũ tháng 8 + 3 dòng mới tháng 9

  // Tìm các dòng mới theo mã giao dịch
  const rowPaidCached = writtenRows.find((r) => r[7] === "#DEER-1");
  const rowCrossMonth = writtenRows.find((r) => r[7] === "#DEER-2");
  const rowPending = writtenRows.find((r) => r[7] === "#DEER-3");
  const rowCrossMonthOld = writtenRows.find((r) => r[7] === "#DEER-OLD-CROSS");

  assert.ok(rowPaidCached, "Phải ghi dòng ord_1");
  assert.ok(rowCrossMonth, "Phải ghi dòng ord_2");
  assert.ok(rowPending, "Phải ghi dòng ord_3");
  assert.ok(rowCrossMonthOld, "Phải giữ lại dòng tháng 8 #DEER-OLD-CROSS");

  // Dòng 1 dùng cached range
  assert.equal(
    rowPaidCached[1],
    "2026-08-30 - 2026-09-02",
    "Dòng có payout paid phải nhận đúng giá trị cache",
  );

  // Dòng 2 vắt tháng từ API fallback: 31/08 và 01/09 -> '2026-08-31 - 2026-09-01'
  assert.equal(
    rowCrossMonth[1],
    "2026-08-31 - 2026-09-01",
    "Payout vắt tháng phải tính đầy đủ ngày từ API thay vì chỉ lấy ngày trong tháng 9",
  );

  // Dòng cũ tháng 8 (#DEER-OLD-CROSS) được backfill cột B thành range mới đầy đủ
  assert.equal(
    rowCrossMonthOld[1],
    "2026-08-31 - 2026-09-01",
    "Dòng cũ tháng 8 của payout vắt tháng phải được tự động backfill range mới đầy đủ",
  );

  // Dòng 3 pending từ API fallback: '2026-09-02'
  assert.equal(
    rowPending[1],
    "2026-09-02",
    "Payout pending lấy đúng ngày từ API fallback",
  );
});

test("Cache payout: từ chối cache khi khoảng ngày trên sheet không bao phủ ngày giao dịch đã biết của tháng hiện tại", () => {
  const payouts = new Map<string, ShopifyPayout>([
    ["po_paid_incomplete", { id: "po_paid_incomplete", status: "paid" }],
  ]);

  // Giả sử trên sheet dòng cũ có range là '2026-08-30 - 2026-08-31'
  const existingRows: unknown[][] = [
    [...HEADERS],
    [
      "2026-08-31 22:00",
      "2026-08-30 - 2026-08-31",
      "",
      "",
      "",
      "",
      "",
      "",
      "po_paid_incomplete",
    ],
  ];

  // Nhưng trong tháng hiện tại đang đồng bộ, phát hiện 1 giao dịch thuộc payout này ngày 01/09
  const currentMonthTransactions: ShopifyTransaction[] = [
    {
      payout_id: "po_paid_incomplete",
      processed_at: "2026-09-01T08:00:00+07:00",
      type: "charge",
    },
  ];

  // Hàm helper kiểm tra ngày có nằm trong khoảng không
  assert.equal(
    isDateCoveredByRange("2026-09-01", "2026-08-30 - 2026-08-31"),
    false,
  );
  assert.equal(
    isDateCoveredByRange("2026-08-31", "2026-08-30 - 2026-08-31"),
    true,
  );

  // Khi truyền currentMonthTransactions vào, extractPayoutDateRangeCache phát hiện ngày 01/09
  // không nằm trong khoảng 30/08 - 31/08 -> cache bị từ chối
  const cache = extractPayoutDateRangeCache(
    existingRows,
    payouts,
    currentMonthTransactions,
  );
  assert.equal(
    cache.has("po_paid_incomplete"),
    false,
    "Phải từ chối cache khi có ngày giao dịch thực tế nằm ngoài khoảng cache",
  );
});

test("Cache payout: tùy chọn bypassPayoutCache buộc gọi API làm mới và backfill cột B toàn bộ dòng cùng payout trên sheet", async () => {
  setupMockEnv();
  const shopifyCalls: string[] = [];

  const monthTransactions = [
    {
      id: "tx_1",
      type: "charge",
      processed_at: "2026-09-01T08:00:00.000Z",
      currency: "USD",
      amount: "100.00",
      fee: "3.20",
      net: "96.80",
      payout_id: "po_paid_cached",
      payout_status: "paid",
      source_order_id: "ord_1",
    },
  ];

  const payoutsList = [
    { id: "po_paid_cached", status: "paid", date: "2026-09-04" },
  ];

  const mockShopifyFetch: typeof fetch = async (input) => {
    const url = String(input);
    shopifyCalls.push(url);

    if (url.includes("processed_at_min")) {
      return createMockResponse({ transactions: monthTransactions });
    }
    if (url.includes("payouts.json")) {
      return createMockResponse({ payouts: payoutsList });
    }
    if (url.includes("graphql.json")) {
      return createMockResponse({
        data: {
          nodes: [
            {
              id: "gid://shopify/Order/ord_1",
              name: "#DEER-1",
              currentTotalTaxSet: { shopMoney: { amount: "0.00" } },
            },
          ],
        },
      });
    }
    if (url.includes("payout_id=po_paid_cached")) {
      // API Shopify trả về range mới được tính toán lại: 31/08 và 01/09
      return createMockResponse({
        transactions: [
          {
            type: "charge",
            processed_at: "2026-08-31T20:00:00+07:00",
          },
          {
            type: "charge",
            processed_at: "2026-09-01T08:00:00+07:00",
          },
        ],
      });
    }

    return createMockResponse({});
  };

  let writtenBatchData: { range: string; values: SheetValue[][] }[] = [];

  const mockGoogleRequest = async (
    _token: string,
    path: string,
    init?: RequestInit,
  ) => {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: true, canModifyContent: true },
      });
    }
    if (decoded.includes("fields=sheets")) {
      return createMockResponse({
        sheets: [
          { properties: { sheetId: 0, title: "RAW sàn" }, protectedRanges: [] },
        ],
      });
    }
    if (decoded.includes("A1:Y1")) {
      return createMockResponse({ values: [[...HEADERS]] });
    }
    if (decoded.includes("A1:Y")) {
      return createMockResponse({
        values: [
          [...HEADERS],
          [
            "2026-08-31 22:00",
            "2026-08-30 - 2026-08-31", // Giá trị cũ trên sheet chưa có ngày 01/09
            "",
            "The Deerly",
            "Shopify Payments",
            "",
            "USD",
            "#DEER-OLD",
            "po_paid_cached",
            "charge",
            "paid",
            "Đã thanh toán",
            100,
            3,
            "",
            "",
            "",
            97,
            "",
            "2026-09-04",
            "",
            "",
            "",
            "Shopify Payments",
            "2026-08-31 23:00",
          ],
        ],
      });
    }
    if (path.includes("batchUpdate")) {
      const body = JSON.parse(String(init?.body)) as {
        data: { range: string; values: SheetValue[][] }[];
      };
      writtenBatchData = body.data;
      return createMockResponse({});
    }
    if (decoded.includes("A2:Y")) {
      return createMockResponse({
        values: writtenBatchData[0]?.values ?? [],
      });
    }
    return createMockResponse({});
  };

  const context: ShopifySyncContext = {
    getGoogleDriveAccess: async () => ({ accessToken: "mock-google-token" }),
    googleRequest: mockGoogleRequest,
    shopifyFetch: mockShopifyFetch,
    bypassPayoutCache: true, // Kích hoạt bỏ qua cache
  };

  await syncShopifyRawMonthToSheet("2026-09", context);

  assert.ok(
    shopifyCalls.some((call) => call.includes("payout_id=po_paid_cached")),
    "Khi bypassPayoutCache=true, API payout_id PHẢI được gọi để lấy mới toàn bộ",
  );

  // Kiểm tra cả dòng tháng 9 và dòng tháng 8 đều được backfill range mới
  const writtenRows = writtenBatchData[0].values;
  const month9Row = writtenRows.find((r) => r[7] === "#DEER-1");
  const month8Row = writtenRows.find((r) => r[7] === "#DEER-OLD");
  assert.ok(month9Row, "Phải có dòng tháng 9");
  assert.ok(month8Row, "Phải có dòng tháng 8 được giữ lại");
  assert.equal(
    month9Row[1],
    "2026-08-31 - 2026-09-01",
    "Dòng tháng 9 nhận range mới từ API",
  );
  assert.equal(
    month8Row[1],
    "2026-08-31 - 2026-09-01",
    "Dòng tháng 8 cũng phải được backfill đồng bộ range mới từ API",
  );
});

test("Concurrency: ngăn chặn hai tiến trình sync chạy đồng thời trên tab RAW sàn", async () => {
  setupMockEnv();
  let delayResolve = () => {};
  const delayedPromise = new Promise<void>((resolve) => {
    delayResolve = resolve;
  });

  const mockGoogleRequest = async (_token: string, path: string) => {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("capabilities(canEdit")) {
      return createMockResponse({
        capabilities: { canEdit: true, canModifyContent: true },
      });
    }
    if (decoded.includes("fields=sheets")) {
      return createMockResponse({
        sheets: [
          { properties: { sheetId: 0, title: "RAW sàn" }, protectedRanges: [] },
        ],
      });
    }
    if (decoded.includes("A1:Y1")) {
      return createMockResponse({ values: [[...HEADERS]] });
    }
    return createMockResponse({});
  };

  const mockShopifyFetch: typeof fetch = async () => {
    // Tạm dừng ở request đầu tiên để giả lập tiến trình sync đang chạy
    await delayedPromise;
    return createMockResponse({ transactions: [] });
  };

  const context1: ShopifySyncContext = {
    getGoogleDriveAccess: async () => ({ accessToken: "mock-token" }),
    googleRequest: mockGoogleRequest,
    shopifyFetch: mockShopifyFetch,
  };

  const context2: ShopifySyncContext = {
    getGoogleDriveAccess: async () => ({ accessToken: "mock-token" }),
    googleRequest: mockGoogleRequest,
    shopifyFetch: mockShopifyFetch,
  };

  // Khởi chạy sync 1 (sẽ bị treo chờ delayedPromise)
  const sync1Promise = syncShopifyRawMonthToSheet("2026-09", context1);

  // Khởi chạy sync 2 ngay trong khi sync 1 đang chạy -> phải bị chặn lập tức
  await assert.rejects(async () => {
    await syncShopifyRawMonthToSheet("2026-09", context2);
  }, /Một tiến trình đồng bộ khác đang chạy/i);

  // Giải phóng sync 1
  delayResolve();
  await assert.rejects(async () => {
    await sync1Promise;
  }, /không trả giao dịch nào/i);
});
