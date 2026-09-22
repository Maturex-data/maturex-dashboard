import {
  amount,
  type CogsRow,
  type DateRange,
  date,
  fetchWithTimeout,
  type JsonRecord,
  makeRow,
  type ProgressReporter,
  record,
  text,
} from "../types";

export async function fetchPrintify(
  range: DateRange,
  report?: ProgressReporter,
): Promise<CogsRow[]> {
  const token = process.env.PRINTIFY_ACCESS_TOKEN;
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!token || !shopId) throw new Error("Printify credentials are missing.");
  const firstUrl = `https://api.printify.com/v1/shops/${shopId}/orders.json?page=1&limit=50`;
  const firstResponse = await fetchWithTimeout(firstUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const first = (await firstResponse.json()) as JsonRecord;
  if (!firstResponse.ok)
    throw new Error(`Printify API ${firstResponse.status}`);
  const lastPage = Math.max(1, amount(first.last_page));
  const pages = [first];
  await report?.({
    pagesProcessed: 1,
    totalPages: lastPage,
    rowsFetched: Array.isArray(first.data) ? first.data.length : 0,
    checkpoint: { page: 1 },
  });
  for (let start = 2; start <= lastPage; start += 5) {
    const pageNumbers = Array.from(
      { length: Math.min(5, lastPage - start + 1) },
      (_, index) => start + index,
    );
    const batch = await Promise.all(
      pageNumbers.map((page) =>
        fetchWithTimeout(
          `https://api.printify.com/v1/shops/${shopId}/orders.json?page=${page}&limit=50`,
          { headers: { Authorization: `Bearer ${token}` } },
        ).then(async (response) => {
          if (!response.ok) throw new Error(`Printify API ${response.status}`);
          return (await response.json()) as JsonRecord;
        }),
      ),
    );
    pages.push(...batch);
    await report?.({
      pagesProcessed: pages.length,
      totalPages: lastPage,
      rowsFetched: pages.reduce(
        (sum, page) => sum + (Array.isArray(page.data) ? page.data.length : 0),
        0,
      ),
      checkpoint: { page: pageNumbers.at(-1) },
    });
  }
  return pages.flatMap((page) => {
    const orders = Array.isArray(page.data) ? page.data : [];
    return orders.flatMap((rawOrder) => {
      const order = record(rawOrder);
      const created = date(order.created_at);
      if (created < range.from || created >= range.to) return [];
      const items = Array.isArray(order.line_items) ? order.line_items : [];
      return items.map((rawItem, index) => {
        const item = record(rawItem);
        const orderId = text(order.id);
        const cost = amount(item.cost) / 100;
        const shipping = amount(item.shipping_cost) / 100;
        return makeRow(
          "Printify",
          orderId,
          created,
          order.app_order_id || record(order.metadata).shop_order_label,
          orderId,
          cost + shipping,
          cost + shipping,
          `${text(item.id) || index}`,
          { order, item },
        );
      });
    });
  });
}
