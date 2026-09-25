import crypto from "node:crypto";
import { formatVietnamDate, formatVietnamPeriod } from "./date-utils";
import type { MicromCogsRow } from "./types";

export interface PGPrintChildDetail {
  id?: string | number;
  name?: string;
  sku?: string;
  quantity?: number;
  status?: string;
  sellerCost?: number;
  productCost?: number;
  trackingNumber?: string;
}

export interface PGPrintOrder {
  id: string;
  pgcOrderId?: string;
  orderId?: string; // Often matches customer/Shopify order id
  createdAt: string;
  customer?: { name?: string };
  productCost?: number;
  shippingFee?: number;
  surchargeFee?: number;
  totalCost?: number;
  status?: string;
  itemStatuses?: string[];
  childDetails?: PGPrintChildDetail[];
}

export interface FetchPGPrintOptions {
  fromTime?: number;
  toTime?: number;
  pageSize?: number;
  maxPages?: number;
}

export async function fetchMicromPGPrintOrders(
  options: FetchPGPrintOptions = {},
): Promise<{
  orders: PGPrintOrder[];
  cogsRows: MicromCogsRow[];
}> {
  const shopId = process.env.MICROM_PGPRINT_SHOP_ID;
  const secret = process.env.MICROM_PGPRINT_SECRET;

  if (!shopId || !secret) {
    throw new Error(
      "MICROM_PGPRINT_SHOP_ID and MICROM_PGPRINT_SECRET must be configured.",
    );
  }

  const fromTime = options.fromTime || Date.parse("2026-01-01T00:00:00.000Z");
  const toTime = options.toTime || Date.now();
  const pageSize = options.pageSize || 100;
  const maxPages = options.maxPages || 200;

  const allOrders: PGPrintOrder[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const body = {
      fromTime,
      toTime,
      page,
      size: pageSize,
    };
    const payload = JSON.stringify(body);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("base64");

    const res = await fetch("https://app.pgprints.io/api/v1/orders/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PGPrints-Store-Id": shopId,
        "X-PGPrints-Hmac-Sha256": signature,
      },
      body: payload,
    });

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PGPrint API error (${res.status}): ${text}`);
    }

    const json = (await res.json()) as {
      success?: boolean;
      data?:
        | {
            data?: PGPrintOrder[];
            orders?: PGPrintOrder[];
            total?: number;
          }
        | PGPrintOrder[];
    };

    let pageItems: PGPrintOrder[] = [];
    if (Array.isArray(json.data)) {
      pageItems = json.data;
    } else if (json.data && Array.isArray(json.data.data)) {
      pageItems = json.data.data;
    } else if (json.data && Array.isArray(json.data.orders)) {
      pageItems = json.data.orders;
    }

    if (pageItems.length === 0) {
      hasMore = false;
    } else {
      allOrders.push(...pageItems);
      if (pageItems.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  // Guard against silent pagination truncation
  if (hasMore) {
    throw new Error(
      `PGPrint pagination overflow: reached limit of ${maxPages} pages while more orders exist. Increase maxPages or narrow date window.`,
    );
  }

  // Map to Sheet COGS Rows
  const cogsRows: MicromCogsRow[] = [];

  for (const o of allOrders) {
    const ngayTao = formatVietnamDate(o.createdAt);
    const ky = formatVietnamPeriod(o.createdAt);

    // Determine status
    let statusSource = o.status || "";
    if (!statusSource && o.itemStatuses && o.itemStatuses.length > 0) {
      statusSource = o.itemStatuses.join(", ");
    }

    const children = o.childDetails || [];
    const production = Number(o.productCost || 0);
    const shipping = Number(o.shippingFee || 0);
    const totalCost = Number(o.totalCost || 0);

    // If order has multiple distinct child items, we map each child with a composite key
    if (children.length > 1) {
      let childIndex = 0;
      for (const child of children) {
        childIndex++;
        const childStatus = child.status || statusSource;
        const childCost = Number(
          child.sellerCost || child.productCost || totalCost / children.length,
        );
        const childProd = Number(
          child.productCost || production / children.length,
        );
        const childShip = Number(shipping / children.length);

        const isChildFulfilled =
          childStatus.toLowerCase().includes("fulfilled") ||
          childStatus.toLowerCase().includes("completed") ||
          childStatus.toLowerCase().includes("delivered");

        const cogsDuDieuKienUsd = isChildFulfilled ? childCost : 0;
        const kiemSoat = isChildFulfilled
          ? "Đã đối soát fulfilled; chi phí hợp lệ ghi nhận"
          : `Trạng thái: ${childStatus || "trống"}; chưa đủ điều kiện ghi nhận chi phí`;

        const itemPart = child.id || `${child.sku || "item"}-${childIndex}`;

        cogsRows.push({
          pgprintOrderId: o.id,
          pgcOrderId: o.pgcOrderId || "",
          customerOrderId: o.orderId || "",
          ngayTao,
          ky,
          statusSource: childStatus,
          currency: "USD",
          production: childProd,
          shipping: childShip,
          cogsSourceUsd: childCost,
          cogsDuDieuKienUsd,
          nguonDong: `PGPrint API | Order ${o.id} | Item ${itemPart}`,
          kiemSoat,
        });
      }
    } else {
      // Single order / single detail row
      const isFulfilled =
        statusSource.toLowerCase().includes("fulfilled") ||
        statusSource.toLowerCase().includes("completed") ||
        statusSource.toLowerCase().includes("delivered");

      const cogsDuDieuKienUsd = isFulfilled ? totalCost : 0;
      const kiemSoat = isFulfilled
        ? "Đã đối soát fulfilled; chi phí hợp lệ ghi nhận"
        : `Trạng thái nguồn: ${statusSource || "trống"}; giữ nguyên theo dõi, cogs đủ điều kiện = 0`;

      cogsRows.push({
        pgprintOrderId: o.id,
        pgcOrderId: o.pgcOrderId || "",
        customerOrderId: o.orderId || "",
        ngayTao,
        ky,
        statusSource,
        currency: "USD",
        production,
        shipping,
        cogsSourceUsd: totalCost,
        cogsDuDieuKienUsd,
        nguonDong: `PGPrint API | Order ${o.id}`,
        kiemSoat,
      });
    }
  }

  return { orders: allOrders, cogsRows };
}
