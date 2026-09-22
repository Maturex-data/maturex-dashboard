import { Prisma } from "@/generated/prisma/client";
import { formatVietnamDate } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

const INITIAL_SYNC_DATE = "2026-01-01";
const PAGE_SIZE = 100;
const MAX_RETRIES = 3;

type Money = {
  shopMoney: {
    amount: string;
  };
};

export type ShopifyOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  currentTotalDiscountsSet: Money;
  currentTotalPriceSet: Money;
  currentTotalTaxSet: Money;
  totalPriceSet: Money;
  totalShippingPriceSet: Money;
  tags: string[];
  lineItems: {
    nodes: Array<{
      name: string;
      quantity: number;
      originalTotalSet: Money;
    }>;
  };
  fulfillments: Array<{
    createdAt: string;
    deliveredAt: string | null;
    displayStatus: string;
    updatedAt: string;
  }>;
  refunds: Array<{
    createdAt: string;
    totalRefundedSet: Money;
  }>;
};

type ShopifyOrdersResponse = {
  data?: {
    orders: {
      nodes: ShopifyOrderNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
  errors?: Array<{
    extensions?: { code?: string };
    message: string;
  }>;
};

type ShopifyOrdersConnection = NonNullable<
  ShopifyOrdersResponse["data"]
>["orders"];

type SyncResult = {
  addedCount: number;
  pageCount: number;
  skippedCount: number;
};

const ORDERS_QUERY = `
  query RawOrderSync($after: String, $first: Int!, $query: String!) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT) {
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        currentTotalDiscountsSet { shopMoney { amount } }
        currentTotalPriceSet { shopMoney { amount } }
        currentTotalTaxSet { shopMoney { amount } }
        totalPriceSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        tags
        lineItems(first: 250) {
          nodes {
            name
            quantity
            originalTotalSet { shopMoney { amount } }
          }
        }
        fulfillments(first: 250) {
          createdAt
          deliveredAt
          displayStatus
          updatedAt
        }
        refunds {
          createdAt
          totalRefundedSet { shopMoney { amount } }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

class ShopifySyncError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "ShopifySyncError";
    this.retryable = retryable;
  }
}

function getShopifyEndpoint(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";

  if (!domain) {
    throw new Error("SHOPIFY_STORE_DOMAIN must be configured.");
  }

  return `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/admin/api/${apiVersion}/graphql.json`;
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function latestByDate<T extends { createdAt: string }>(records: T[]): T | null {
  return records.reduce<T | null>((latest, record) => {
    if (!latest || record.createdAt > latest.createdAt) {
      return record;
    }

    return latest;
  }, null);
}

function toRawOrder(order: ShopifyOrderNode): Prisma.RawOrderCreateManyInput {
  const latestFulfillment = order.fulfillments.reduce<
    ShopifyOrderNode["fulfillments"][number] | null
  >((latest, fulfillment) => {
    if (!latest || fulfillment.createdAt > latest.createdAt) {
      return fulfillment;
    }

    return latest;
  }, null);
  const latestRefund = latestByDate(order.refunds);
  const refundAmount = order.refunds.reduce(
    (total, refund) =>
      total.add(decimal(refund.totalRefundedSet.shopMoney.amount)),
    new Prisma.Decimal(0),
  );
  const grossSales = order.lineItems.nodes.reduce(
    (total, item) => total.add(decimal(item.originalTotalSet.shopMoney.amount)),
    new Prisma.Decimal(0),
  );
  const deliveryStatus = latestFulfillment?.displayStatus ?? null;

  return {
    shopifyOrderId: order.id,
    orderName: order.name,
    orderDate: asDate(order.createdAt) ?? new Date(),
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    fulfillmentDate: asDate(latestFulfillment?.createdAt),
    deliveryStatus,
    deliveryDate: asDate(latestFulfillment?.deliveredAt),
    grossSales,
    discounts: decimal(
      order.currentTotalDiscountsSet.shopMoney.amount,
    ).negated(),
    shippingCharged: decimal(order.totalShippingPriceSet.shopMoney.amount),
    salesTax: decimal(order.currentTotalTaxSet.shopMoney.amount),
    orderTotalBeforeRefund: decimal(order.totalPriceSet.shopMoney.amount),
    orderTotal: decimal(order.currentTotalPriceSet.shopMoney.amount),
    refundAmount,
    calcOrderNetAfterRefund: decimal(order.totalPriceSet.shopMoney.amount).sub(
      refundAmount,
    ),
    refundDate: asDate(latestRefund?.createdAt),
    items: order.lineItems.nodes.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    tag: order.tags.join(", ") || null,
  };
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchOrdersPage(
  after: string | null,
  query: string,
): Promise<ShopifyOrdersConnection> {
  const token = process.env.SHOPIFY_ACCESS_TOKEN?.trim();

  if (!token) {
    throw new Error("SHOPIFY_ACCESS_TOKEN must be configured.");
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(getShopifyEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          query: ORDERS_QUERY,
          variables: { after, first: PAGE_SIZE, query },
        }),
        cache: "no-store",
      });
      const payload = (await response.json()) as ShopifyOrdersResponse;
      const throttled = payload.errors?.some(
        (error) => error.extensions?.code === "THROTTLED",
      );

      if (!response.ok || payload.errors?.length || !payload.data) {
        const message =
          payload.errors?.map((error) => error.message).join("; ") ||
          `Shopify returned HTTP ${response.status}.`;
        throw new ShopifySyncError(
          message,
          response.status === 429 ||
            response.status >= 500 ||
            throttled === true,
        );
      }

      return payload.data.orders;
    } catch (error) {
      const retryable =
        error instanceof ShopifySyncError ? error.retryable : true;

      if (!retryable || attempt === MAX_RETRIES) {
        throw error;
      }

      await sleep(500 * 2 ** (attempt - 1));
    }
  }

  throw new Error("Shopify sync retry limit reached.");
}

export async function fetchShopifyOrdersFromApi(range: {
  from: Date;
  to: Date;
}): Promise<ShopifyOrderNode[]> {
  const fromDay = formatVietnamDate(range.from);
  const untilDay = formatVietnamDate(new Date(range.to.getTime() - 1));
  const query = `created_at:>=${range.from.toISOString()} created_at:<${range.to.toISOString()}`;
  const orders: ShopifyOrderNode[] = [];
  let after: string | null = null;

  do {
    const page = await fetchOrdersPage(after, query);
    orders.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  return orders.filter((order) => {
    const orderDay = formatVietnamDate(new Date(order.createdAt));
    return orderDay >= fromDay && orderDay <= untilDay;
  });
}

let activeSync: Promise<SyncResult> | null = null;

export async function syncShopifyRawOrders(): Promise<SyncResult> {
  if (activeSync) {
    throw new Error("A Shopify sync is already running.");
  }

  activeSync = runSync();

  try {
    return await activeSync;
  } finally {
    activeSync = null;
  }
}

async function runSync(): Promise<SyncResult> {
  const existingRun = await prisma.shopifySyncRun.findFirst({
    where: { status: "RUNNING" },
    select: { id: true },
  });

  if (existingRun) {
    throw new Error("A Shopify sync is already running.");
  }

  const run = await prisma.shopifySyncRun.create({
    data: { status: "RUNNING" },
  });

  try {
    const latestOrder = await prisma.rawOrder.findFirst({
      orderBy: { orderDate: "desc" },
      select: { orderDate: true },
    });
    const fromDate =
      (latestOrder ? formatVietnamDate(latestOrder.orderDate) : null) ??
      INITIAL_SYNC_DATE;
    const query = `created_at:>=${fromDate}`;
    let after: string | null = null;
    let pageCount = 0;
    let addedCount = 0;
    let skippedCount = 0;

    do {
      const page = await fetchOrdersPage(after, query);
      const result = page.nodes.length
        ? await prisma.rawOrder.createMany({
            data: page.nodes.map(toRawOrder),
            skipDuplicates: true,
          })
        : { count: 0 };

      pageCount += 1;
      addedCount += result.count;
      skippedCount += page.nodes.length - result.count;
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    await prisma.shopifySyncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        pageCount,
        addedCount,
        skippedCount,
      },
    });

    return { addedCount, pageCount, skippedCount };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error.";

    await prisma.shopifySyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      },
    });

    throw error;
  }
}
