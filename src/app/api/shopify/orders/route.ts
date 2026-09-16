import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isMonth(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}$/.test(value);
}

function monthBounds(month: string): { from: Date; to: Date } {
  const [year, monthNumber] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, monthNumber - 1, 1));
  const to = new Date(Date.UTC(year, monthNumber, 1));

  return { from, to };
}

function toDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const latest = await prisma.rawOrder.findFirst({
    orderBy: { orderDate: "desc" },
    select: { orderDate: true },
  });
  const latestMonth = latest?.orderDate.toISOString().slice(0, 7) ?? null;
  const month = isMonth(url.searchParams.get("month"))
    ? url.searchParams.get("month")
    : latestMonth;

  const rows = month
    ? await prisma.rawOrder.findMany({
        where: (() => {
          const bounds = monthBounds(month);
          return { orderDate: { gte: bounds.from, lt: bounds.to } };
        })(),
        orderBy: [{ orderDate: "desc" }, { orderName: "asc" }],
      })
    : [];
  const months = await prisma.rawOrder.findMany({
    distinct: ["orderDate"],
    orderBy: { orderDate: "desc" },
    select: { orderDate: true },
  });

  return Response.json({
    month,
    months: [
      ...new Set(months.map((row) => row.orderDate.toISOString().slice(0, 7))),
    ],
    rows: rows.map((row) => ({
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
      refund_date: toDate(row.refundDate),
      items: row.items,
      tag: row.tag,
    })),
  });
}
