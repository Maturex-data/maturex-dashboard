import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { sortMonthKeys } from "@/lib/etsy-months";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shopCode = searchParams.get("shop");
    const month = searchParams.get("month"); // 'YYYY-MM'
    const search = searchParams.get("search")?.trim().toLowerCase();
    const sort = searchParams.get("sort") || "sale_date";
    const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";
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

    const [total, rows, shops, monthRows] = await Promise.all([
      prisma.etsyOrder.count({ where }),
      prisma.etsyOrder.findMany({
        where,
        include: {
          shop: { select: { code: true, name: true } },
        },
        orderBy: [
          sort === "order_id"
            ? { orderId: direction }
            : sort === "order_value"
              ? { orderValue: direction }
              : sort === "order_total"
                ? { orderTotal: direction }
                : sort === "order_net"
                  ? { orderNet: direction }
                  : { saleDate: direction },
          { id: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.etsyShop.findMany({
        select: { code: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.etsyOrder.findMany({
        select: { saleDate: true },
        distinct: ["saleDate"],
        orderBy: { saleDate: "desc" },
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
        buyer_user_id: r.buyerUserId || "—",
        first_name: r.firstName || "—",
        last_name: r.lastName || "—",
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
        street_1: r.street1 || "—",
        street_2: r.street2 || "—",
        ship_state: r.shipState || "—",
        ship_zipcode: r.shipZipcode || "—",
        coupon_code: r.couponCode || "—",
        coupon_details: r.couponDetails || "—",
        shipping_discount: r.shippingDiscount?.toString() || "0",
        adjusted_order_total: r.adjustedOrderTotal?.toString() || "0",
        adjusted_card_processing_fees:
          r.adjustedCardProcessingFees?.toString() || "0",
        adjusted_net_order_amount: r.adjustedNetOrderAmount?.toString() || "0",
        buyer: r.buyer || "—",
        order_type: r.orderType || "—",
        payment_type: r.paymentType || "—",
        in_person_discount: r.inPersonDiscount?.toString() || "0",
        in_person_location: r.inPersonLocation || "—",
        sku: r.sku || "—",
        payment_method: r.paymentMethod || "—",
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      shops,
      availableMonths: sortMonthKeys(monthRows.map((row) => row.saleDate)),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch orders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
