import {
  amount,
  type CogsRow,
  type DateRange,
  fetchWithTimeout,
  type JsonRecord,
  makeRow,
  type ProgressReporter,
  record,
  text,
  validDate,
} from "../types";

const PRINTPOSS_ORDERS_URL = "https://api.printposs.com/api/v1/seller/orders";
const PAGE_SIZE = 100;
const MAX_PAGES = 1_000;

function itemName(value: unknown): string {
  const item = record(value);
  const variant = record(item.product_variant);
  return text(variant.name) || text(item.name) || text(variant.sku);
}

function makePrintPossRow(order: JsonRecord, range: DateRange): CogsRow | null {
  const orderNumber = text(order.order_number);
  const createdAt = validDate(order.created_at);
  if (
    !orderNumber ||
    !createdAt ||
    createdAt < range.from ||
    createdAt >= range.to
  ) {
    return null;
  }

  const items = Array.isArray(order.items) ? order.items.map(record) : [];
  const names = items
    .map((item) => {
      const name = itemName(item);
      if (!name) return "";
      const quantity = Math.max(1, amount(item.quantity));
      return quantity > 1 ? `${name} ×${quantity}` : name;
    })
    .filter(Boolean);
  const costs = Array.isArray(order.costs)
    ? order.costs.map((value) => {
        const cost = record(value);
        return {
          type: text(cost.type),
          amount: amount(cost.amount),
          metadata: cost.metadata ?? null,
        };
      })
    : [];
  const totalCost =
    order.total_cost === null || order.total_cost === undefined
      ? costs.reduce((sum, cost) => sum + cost.amount, 0)
      : amount(order.total_cost);
  const externalOrderId = text(order.external_order_id);

  const row = makeRow(
    "PrintPoss",
    orderNumber,
    createdAt,
    externalOrderId,
    orderNumber,
    totalCost,
    totalCost,
    "order",
    {
      order: {
        order_number: orderNumber,
        external_order_id: externalOrderId,
        created_at: createdAt.toISOString(),
        total_cost: totalCost,
        order_status: text(order.order_status),
        payment_status: text(order.payment_status),
        is_sample: order.is_sample === true,
      },
      item: { name: names.join(" | ") },
      items: items.map((item) => {
        const variant = record(item.product_variant);
        return {
          id: text(item.id),
          name: itemName(item),
          sku: text(variant.sku),
          quantity: amount(item.quantity),
        };
      }),
      costs,
    },
  );

  // PrintPoss contributes one order-level COGS row, matching the existing
  // spreadsheet preview key and avoiding an invented per-item cost split.
  return { ...row, itemKey: `PrintPoss:${orderNumber}` };
}

export async function fetchPrintPoss(
  range: DateRange,
  report?: ProgressReporter,
): Promise<CogsRow[]> {
  const token = process.env.PRINTPOSS_API_TOKEN?.trim();
  if (!token) throw new Error("PrintPoss API token is missing.");

  const rows: CogsRow[] = [];
  let page = 1;
  let totalPages: number | undefined;

  while (page <= MAX_PAGES) {
    const url = new URL(PRINTPOSS_ORDERS_URL);
    url.searchParams.set("include", "items,costs");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(PAGE_SIZE));

    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    let payload: JsonRecord;
    try {
      payload = record(await response.json());
    } catch {
      throw new Error(
        `PrintPoss API ${response.status} returned invalid JSON.`,
      );
    }
    if (!response.ok || payload.success === false) {
      throw new Error(`PrintPoss API ${response.status}`);
    }

    const pageOrders = Array.isArray(payload.data)
      ? payload.data.map(record)
      : [];
    const meta = record(payload.meta);
    const links = record(payload.links);
    const pageCount = amount(meta.last_page);
    if (pageCount > 0) totalPages = pageCount;

    for (const order of pageOrders) {
      const row = makePrintPossRow(order, range);
      if (row) rows.push(row);
    }

    await report?.({
      pagesProcessed: page,
      totalPages,
      rowsFetched: rows.length,
      checkpoint: { page },
    });

    const hasNext = Boolean(text(links.next));
    if (
      totalPages
        ? page >= totalPages
        : !hasNext && pageOrders.length < PAGE_SIZE
    ) {
      return rows;
    }
    if (!totalPages && !hasNext && pageOrders.length === 0) return rows;
    page += 1;
  }

  throw new Error(
    `PrintPoss pagination exceeded ${MAX_PAGES} pages. Narrow the sync range or increase the page limit.`,
  );
}
