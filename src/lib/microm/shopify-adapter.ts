import { formatVietnamDate, formatVietnamPeriod } from "./date-utils";
import type { MicromOrderRow, MicromShopifyItemRow } from "./types";

export interface ShopifyOrder {
  id: number;
  name: string; // e.g. #TM1001DE
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  financial_status: string; // paid, voided, refunded, partially_refunded, pending
  fulfillment_status: string | null;
  currency: string;
  subtotal_price: string;
  total_discounts: string;
  total_shipping_price_set?: {
    shop_money?: { amount: string; currency_code: string };
  };
  total_tax: string;
  total_price: string;
  refunds?: Array<{
    id: number;
    refund_line_items?: Array<{
      subtotal: number;
      total_tax: number;
    }>;
    transactions?: Array<{
      amount: string;
      status: string;
      kind: string;
    }>;
  }>;
  line_items?: Array<{
    id: number;
    title: string;
    variant_title?: string | null;
    sku: string | null;
    quantity: number;
    price: string;
    fulfillment_status: string | null;
  }>;
}

export interface FetchShopifyOrdersOptions {
  sinceDate?: string;
  limit?: number;
  maxPages?: number;
}

export async function fetchMicromShopifyOrders(
  options: FetchShopifyOrdersOptions = {},
): Promise<{
  orders: ShopifyOrder[];
  orderRows: MicromOrderRow[];
  itemRows: MicromShopifyItemRow[];
}> {
  const domain =
    process.env.MICROM_SHOPIFY_STORE_DOMAIN || "ib2w0p-ka.myshopify.com";
  const token = process.env.MICROM_SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";

  if (!token) {
    throw new Error("MICROM_SHOPIFY_ACCESS_TOKEN must be configured.");
  }

  const sinceDate = options.sinceDate || "2026-01-01T00:00:00Z";
  const limit = options.limit || 250;
  const maxPages = options.maxPages || 200;

  const allOrders: ShopifyOrder[] = [];
  let nextUrl: string | null =
    `https://${domain}/admin/api/${apiVersion}/orders.json?status=any&limit=${limit}&created_at_min=${encodeURIComponent(sinceDate)}`;

  let pages = 0;
  while (nextUrl && pages < maxPages) {
    pages++;
    const res: Response = await fetch(nextUrl, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") || "2");
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { orders?: ShopifyOrder[] };
    const pageOrders = data.orders || [];
    allOrders.push(...pageOrders);

    // Parse Link header for pagination
    const linkHeader: string | null = res.headers.get("Link");
    if (linkHeader?.includes('rel="next"')) {
      const match: RegExpMatchArray | null = linkHeader.match(
        /<([^>]+)>;\s*rel="next"/,
      );
      nextUrl = match ? match[1] : null;
    } else {
      nextUrl = null;
    }
  }

  // Guard against silent truncation if more pages exist
  if (nextUrl) {
    throw new Error(
      `Shopify pagination overflow: reached limit of ${maxPages} pages while more orders exist. Increase maxPages or narrow sinceDate.`,
    );
  }

  // Map to Sheet Rows
  const orderRows: MicromOrderRow[] = [];
  const itemRows: MicromShopifyItemRow[] = [];

  for (const order of allOrders) {
    const ngayTao = formatVietnamDate(order.created_at);
    const ky = formatVietnamPeriod(order.created_at);
    const subtotal = Number(order.subtotal_price || 0);
    const discount = Number(order.total_discounts || 0);
    const shipping = Number(
      order.total_shipping_price_set?.shop_money?.amount || 0,
    );
    const tax = Number(order.total_tax || 0);
    const grossOrder = Number(order.total_price || 0);

    // Compute Eligible Revenue (EUR):
    // Only 'paid', 'partially_refunded', and the received portion of 'partially_paid' are eligible.
    // Voided, cancelled, pending, authorized, refunded, or unknown = 0.
    let doanhThuHopLeEur = 0;
    const isCancelled = order.cancelled_at !== null;
    const isVoided = order.financial_status === "voided";

    if (!isCancelled && !isVoided) {
      if (order.financial_status === "paid") {
        doanhThuHopLeEur = grossOrder;
      } else if (order.financial_status === "partially_refunded") {
        let totalRefunded = 0;
        if (order.refunds) {
          for (const rf of order.refunds) {
            for (const tx of rf.transactions || []) {
              if (tx.status === "success" && tx.kind === "refund") {
                totalRefunded += Number(tx.amount || 0);
              }
            }
          }
        }
        doanhThuHopLeEur = Math.max(0, grossOrder - totalRefunded);
      } else if (order.financial_status === "partially_paid") {
        const outstanding = Number(
          (order as { total_outstanding?: string | number })
            .total_outstanding || 0,
        );
        if (outstanding > 0 && outstanding < grossOrder) {
          doanhThuHopLeEur = Math.max(0, grossOrder - outstanding);
        } else {
          let captured = 0;
          for (const tx of (
            order as {
              transactions?: Array<{
                status?: string;
                kind?: string;
                amount?: string | number;
              }>;
            }
          ).transactions || []) {
            if (
              tx.status === "success" &&
              (tx.kind === "capture" || tx.kind === "sale")
            ) {
              captured += Number(tx.amount || 0);
            }
          }
          doanhThuHopLeEur = captured > 0 ? Math.min(grossOrder, captured) : 0;
        }
      } else {
        // pending, authorized, refunded, etc. -> 0
        doanhThuHopLeEur = 0;
      }
    }

    orderRows.push({
      orderId: order.name,
      shopifyId: String(order.id),
      ngayTao,
      ky,
      trangThaiThanhToan: order.financial_status || "unknown",
      fulfillment: order.fulfillment_status || "unfulfilled",
      currency: order.currency || "EUR",
      subtotal,
      discount,
      shipping,
      tax,
      grossOrder,
      doanhThuHopLeEur,
      nguonDong: `Shopify API | Order ${order.id}`,
    });

    for (const item of order.line_items || []) {
      const lineTotal = Number(item.price || 0) * (item.quantity || 1);
      const title = item.variant_title
        ? `${item.title} - ${item.variant_title}`
        : item.title;

      itemRows.push({
        orderId: order.name,
        lineItemId: String(item.id),
        tenSanPham: title,
        sku: item.sku || "",
        quantity: item.quantity || 1,
        lineTotal,
        currency: order.currency || "EUR",
        fulfillment:
          item.fulfillment_status || order.fulfillment_status || "unfulfilled",
        nguonDong: `Shopify API | Order ${order.id} | LineItem ${item.id}`,
      });
    }
  }

  return { orders: allOrders, orderRows, itemRows };
}
