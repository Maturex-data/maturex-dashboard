import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shopCode = searchParams.get("shop");
    const month = searchParams.get("month"); // 'YYYY-MM'
    const search = searchParams.get("search")?.trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(
      100,
      Math.max(10, Number(searchParams.get("limit") || 50)),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.EtsyOrderWhereInput = {};

    if (shopCode && shopCode !== "all") {
      where.shop = { code: shopCode };
    }

    if (month && month !== "all" && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split("-").map(Number);
      const startDate = new Date(Date.UTC(year, m - 1, 1));
      const endDate = new Date(Date.UTC(year, m, 1));
      where.saleDate = {
        gte: startDate,
        lt: endDate,
      };
    }

    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: "insensitive" } },
        { buyer: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { status: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, rows, shops] = await Promise.all([
      prisma.etsyOrder.count({ where }),
      prisma.etsyOrder.findMany({
        where,
        include: {
          shop: { select: { code: true, name: true } },
        },
        orderBy: [{ saleDate: "desc" }, { orderId: "desc" }],
        skip,
        take: limit,
      }),
      prisma.etsyShop.findMany({
        select: { code: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id,
        shop_code: r.shop.code,
        shop_name: r.shop.name,
        order_id: r.orderId,
        sale_date: r.saleDate ? r.saleDate.toISOString().slice(0, 10) : null,
        full_name: r.fullName || r.buyer || "—",
        number_of_items: r.numberOfItems,
        currency: r.currency || "USD",
        order_value: r.orderValue ? r.orderValue.toString() : "0",
        discount_amount: r.discountAmount ? r.discountAmount.toString() : "0",
        shipping: r.shipping ? r.shipping.toString() : "0",
        sales_tax: r.salesTax ? r.salesTax.toString() : "0",
        order_total: r.orderTotal ? r.orderTotal.toString() : "0",
        card_processing_fees: r.cardProcessingFees
          ? r.cardProcessingFees.toString()
          : "0",
        order_net: r.orderNet ? r.orderNet.toString() : "0",
        status: r.status || "Completed",
        date_shipped: r.dateShipped
          ? r.dateShipped.toISOString().slice(0, 10)
          : null,
        ship_country: r.shipCountry || "—",
        ship_city: r.shipCity || "—",
        sku: r.sku || "—",
        payment_method: r.paymentMethod || "—",
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      shops,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch orders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
