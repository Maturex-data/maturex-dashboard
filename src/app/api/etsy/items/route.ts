import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shopCode = searchParams.get("shop");
    const month = searchParams.get("month");
    const search = searchParams.get("search")?.trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(
      100,
      Math.max(10, Number(searchParams.get("limit") || 50)),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.EtsyOrderItemWhereInput = {};

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
        { itemName: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { buyer: { contains: search, mode: "insensitive" } },
        { transactionId: { contains: search, mode: "insensitive" } },
        { variations: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, rows, shops] = await Promise.all([
      prisma.etsyOrderItem.count({ where }),
      prisma.etsyOrderItem.findMany({
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
        transaction_id: r.transactionId || "—",
        listing_id: r.listingId || "—",
        sale_date: r.saleDate ? r.saleDate.toISOString().slice(0, 10) : null,
        item_name: r.itemName || "—",
        buyer: r.buyer || "—",
        quantity: r.quantity ?? 1,
        price: r.price ? r.price.toString() : "0",
        discount_amount: r.discountAmount ? r.discountAmount.toString() : "0",
        order_shipping: r.orderShipping ? r.orderShipping.toString() : "0",
        order_sales_tax: r.orderSalesTax ? r.orderSalesTax.toString() : "0",
        item_total: r.itemTotal ? r.itemTotal.toString() : "0",
        currency: r.currency || "USD",
        variations: r.variations || "—",
        sku: r.sku || "—",
        match_status: r.matchStatus || "MATCHED",
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      shops,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch order items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
