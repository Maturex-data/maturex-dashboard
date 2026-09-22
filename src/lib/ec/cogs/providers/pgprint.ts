import crypto from "node:crypto";
import {
  amount,
  type CogsRow,
  type DateRange,
  fetchWithTimeout,
  id,
  type JsonRecord,
  makeRow,
  type ProgressReporter,
  record,
  text,
} from "../types";

export async function fetchPgPrint(
  range: DateRange,
  report?: ProgressReporter,
): Promise<CogsRow[]> {
  const shopId = process.env.PGPRINT_SHOP_ID;
  const secret = process.env.PGPRINT_SECRET;
  if (!shopId || !secret) throw new Error("PGPrint credentials are missing.");
  const configuredShopId = shopId;
  const configuredSecret = secret;

  async function fetchPage(page: number): Promise<JsonRecord> {
    const body = JSON.stringify({
      fromTime: range.from.getTime(),
      toTime: range.to.getTime(),
      page,
      size: 20,
    });
    const signature = crypto
      .createHmac("sha256", configuredSecret)
      .update(body)
      .digest("base64");
    const response = await fetchWithTimeout(
      "https://app.pgprints.io/api/v1/orders/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PGPrints-Store-Id": configuredShopId,
          "X-PGPrints-Hmac-Sha256": signature,
        },
        body,
      },
    );
    const payload = (await response.json()) as JsonRecord;
    if (!response.ok || payload.success === false)
      throw new Error(`PGPrint API ${response.status}`);
    return payload;
  }

  function appendRows(rows: CogsRow[], payload: JsonRecord): void {
    const orders = Array.isArray(payload.data) ? payload.data : [];
    for (const rawOrder of orders) {
      const order = record(rawOrder);
      const items = Array.isArray(order.childDetails)
        ? order.childDetails
        : [order];
      items.forEach((rawItem, index) => {
        const item = record(rawItem);
        const total = amount(
          item.sellerCost || item.totalCost || order.totalCost,
        );
        rows.push(
          makeRow(
            "PGPrint",
            id(order.id),
            order.createdAt,
            order.orderId,
            order.pgcOrderId,
            total,
            total,
            text(item.id) || `${index}`,
            { order, item },
          ),
        );
      });
    }
  }

  const rows: CogsRow[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext && page <= 1000) {
    const pages = await Promise.all(
      Array.from({ length: 10 }, (_, offset) => fetchPage(page + offset)),
    );
    for (const payload of pages) {
      appendRows(rows, payload);
      if (payload.pageHasNext !== true) {
        hasNext = false;
        break;
      }
    }
    await report?.({
      pagesProcessed: Math.min(page + pages.length - 1, 1000),
      rowsFetched: rows.length,
      checkpoint: { page: page + pages.length },
    });
    page += 10;
  }
  return rows;
}
