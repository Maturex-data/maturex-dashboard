import type {
  PrintifyOrder,
  PrintifySyncOptions,
} from "@/lib/fl/printify/types";
export function validatePrintifyRange(options?: PrintifySyncOptions) {
  if (!options) return;
  const { fromDate, toDate } = options;
  if (!fromDate && !toDate) return;
  if (
    !fromDate ||
    !toDate ||
    !Number.isFinite(Date.parse(fromDate)) ||
    !Number.isFinite(Date.parse(toDate)) ||
    Date.parse(fromDate) > Date.parse(toDate)
  )
    throw Error("Khoảng thời gian đồng bộ không hợp lệ.");
}
export async function fetchPhucPrintifyOrders() {
  const token = process.env.PHUC_PRINTIFY_ACCESS_TOKEN?.trim(),
    shopId = process.env.PHUC_PRINTIFY_SHOP_ID?.trim();
  if (!token || !shopId || !/^\d+$/.test(shopId))
    throw Error("Thiếu cấu hình Printify Team Phúc.");
  const orders: PrintifyOrder[] = [];
  for (let page = 1; page <= 200; page++) {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(
        `https://api.printify.com/v1/shops/${shopId}/orders.json?limit=50&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "MaturexDashboard/1.0",
            Accept: "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(25000),
        },
      );
      if (response.status !== 429 && response.status < 500) break;
      if (attempt < 2)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(5000, 1000 * (attempt + 1))),
        );
    }
    if (!response?.ok)
      throw Error(
        `Không đọc được Printify (HTTP ${response?.status ?? "unknown"}).`,
      );
    const payload = (await response.json()) as {
      data: PrintifyOrder[];
      current_page: number;
      last_page: number;
    };
    if (!Array.isArray(payload.data) || !Number.isInteger(payload.last_page))
      throw Error("Phân trang Printify không hợp lệ.");
    orders.push(...payload.data);
    if (payload.current_page >= payload.last_page) {
      if (new Set(orders.map((order) => order.id)).size !== orders.length)
        throw Error("Printify trả về ID trùng; hãy thử lại.");
      return orders;
    }
  }
  throw Error("Số trang Printify vượt giới hạn. Chưa ghi dữ liệu.");
}
