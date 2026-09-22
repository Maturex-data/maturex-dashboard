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

export async function fetchPrintful(
  range: DateRange,
  report?: ProgressReporter,
): Promise<CogsRow[]> {
  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) throw new Error("Printful API credentials are missing.");

  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "maturex-dashboard/1.0",
  };
  const orders: JsonRecord[] = [];
  let offset = 0;
  let pagesProcessed = 0;

  while (true) {
    const response = await fetchWithTimeout(
      `https://api.printful.com/orders?offset=${offset}&limit=100`,
      { headers },
    );
    const payload = (await response.json()) as JsonRecord;
    if (!response.ok) throw new Error(`Printful API ${response.status}`);
    const page = Array.isArray(payload.result) ? payload.result : [];
    orders.push(...page.map(record));
    const paging = record(payload.paging);
    const total = amount(paging.total);
    pagesProcessed += 1;
    await report?.({
      pagesProcessed,
      totalPages: total ? Math.ceil(total / 100) : undefined,
      rowsFetched: orders.length,
      checkpoint: { offset: offset + page.length },
    });
    if (page.length === 0 || !total || orders.length >= total) break;
    offset += page.length;
  }

  return orders.flatMap((order) => {
    const created = date(
      amount(order.created) ? amount(order.created) * 1000 : order.created,
    );
    if (created < range.from || created >= range.to) return [];
    const items = Array.isArray(order.items) ? order.items.map(record) : [];
    if (items.length === 0) return [];

    const orderCosts = record(order.costs);
    const orderTotal = amount(orderCosts.total);
    const bases = items.map((item) =>
      Math.max(0, amount(item.price) * Math.max(1, amount(item.quantity))),
    );
    const baseTotal = bases.reduce((sum, value) => sum + value, 0);
    const equalWeight = 1 / items.length;
    let allocated = 0;

    return items.map((item, index) => {
      const weight = baseTotal > 0 ? bases[index] / baseTotal : equalWeight;
      const total =
        index === items.length - 1
          ? Math.max(0, Number((orderTotal - allocated).toFixed(4)))
          : Number((orderTotal * weight).toFixed(4));
      allocated += total;
      const externalId = text(order.external_id);
      const normalizedReference = externalId.replace(/_\d+$/, "");

      return makeRow(
        "Printful",
        text(order.id),
        created,
        normalizedReference || externalId,
        order.id,
        total,
        total,
        text(item.id) || String(index),
        {
          order,
          item,
          cost_allocation: {
            order_total: orderTotal,
            item_base: bases[index],
            base_total: baseTotal,
            allocated_total: total,
            currency: text(orderCosts.currency) || "USD",
          },
        },
      );
    });
  });
}
