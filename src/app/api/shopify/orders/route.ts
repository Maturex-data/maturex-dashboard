import {
  formatVietnamDate,
  formatVietnamMonth,
  vietnamMonthRange,
} from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isMonth(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}$/.test(value);
}

function monthBounds(month: string): { from: Date; to: Date } {
  return vietnamMonthRange(month);
}

function toDate(value: Date | null): string | null {
  return value ? formatVietnamDate(value) : null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const latest = await prisma.rawOrder.findFirst({
    orderBy: { orderDate: "desc" },
    select: { orderDate: true },
  });
  const latestMonth = latest ? formatVietnamMonth(latest.orderDate) : null;
  const monthParam = url.searchParams.get("month");
  const month = isMonth(monthParam)
    ? monthParam
    : monthParam === "all"
      ? null
      : latestMonth;

  const rows = await prisma.rawOrder.findMany({
    where: month
      ? (() => {
          const bounds = monthBounds(month);
          return { orderDate: { gte: bounds.from, lt: bounds.to } };
        })()
      : undefined,
    orderBy: [{ orderDate: "desc" }, { orderName: "asc" }],
  });
  const months = await prisma.rawOrder.findMany({
    distinct: ["orderDate"],
    orderBy: { orderDate: "desc" },
    select: { orderDate: true },
  });

  return Response.json({
    month,
    months: [
      ...new Set(months.map((row) => formatVietnamMonth(row.orderDate))),
    ],
    rows: rows.map((row) => ({
      shopify_order_id: row.shopifyOrderId,
      order_name: row.orderName,
      order_date: toDate(row.orderDate),
      financial_status: row.financialStatus,
      fulfillment_status: row.fulfillmentStatus,
      fulfillment_date: toDate(row.fulfillmentDate),
      delivery_status: row.deliveryStatus,
      delivery_date: toDate(row.deliveryDate),
      gross_sales: row.grossSales.toString(),
      discounts: row.discounts.toString(),
      shipping_charged: row.shippingCharged.toString(),
      sales_tax: row.salesTax.toString(),
      order_total_before_refund: row.orderTotalBeforeRefund.toString(),
      order_total: row.orderTotal.toString(),
      refund_amount: row.refundAmount.toString(),
      calc_order_net_after_refund: row.calcOrderNetAfterRefund.toString(),
      refund_date: toDate(row.refundDate),
      items: row.items,
      tag: row.tag,
    })),
  });
}
