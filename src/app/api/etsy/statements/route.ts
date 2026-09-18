import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { sortMonthKeys } from "@/lib/etsy-months";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shopCode = searchParams.get("shop");
    const month = searchParams.get("month");
    const type = searchParams.get("type");
    const search = searchParams.get("search")?.trim().toLowerCase();
    const sort = searchParams.get("sort") || "statement_date";
    const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(
      100,
      Math.max(10, Number(searchParams.get("limit") || 50)),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.EtsyStatementWhereInput = {};

    if (shopCode && shopCode !== "all") {
      where.shop = { code: shopCode };
    }

    if (month && month !== "all" && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split("-").map(Number);
      const startDate = new Date(Date.UTC(year, m - 1, 1));
      const endDate = new Date(Date.UTC(year, m, 1));
      where.statementDate = {
        gte: startDate,
        lt: endDate,
      };
    }

    if (type && type !== "all") {
      where.type = { equals: type, mode: "insensitive" };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { info: { contains: search, mode: "insensitive" } },
        { extractedOrderId: { contains: search, mode: "insensitive" } },
        { type: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, rows, shops, monthRows] = await Promise.all([
      prisma.etsyStatement.count({ where }),
      prisma.etsyStatement.findMany({
        where,
        include: {
          shop: { select: { code: true, name: true } },
        },
        orderBy: [
          sort === "amount"
            ? { amount: direction }
            : sort === "fees_and_taxes"
              ? { feesAndTaxes: direction }
              : sort === "net"
                ? { net: direction }
                : { statementDate: direction },
          { id: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.etsyShop.findMany({
        select: { code: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.etsyStatement.findMany({
        select: { statementDate: true },
        distinct: ["statementDate"],
        orderBy: { statementDate: "desc" },
      }),
    ]);

    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id,
        shop_code: r.shop.code,
        shop_name: r.shop.name,
        statement_date: r.statementDate
          ? r.statementDate.toISOString().slice(0, 10)
          : null,
        type: r.type,
        title: r.title || "—",
        info: r.info || "—",
        currency: r.currency || "USD",
        amount: r.amount ? r.amount.toString() : "0",
        fees_and_taxes: r.feesAndTaxes ? r.feesAndTaxes.toString() : "0",
        net: r.net ? r.net.toString() : "0",
        tax_details: r.taxDetails || "—",
        extracted_order_id: r.extractedOrderId || null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      shops,
      availableMonths: sortMonthKeys(monthRows.map((row) => row.statementDate)),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch statements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
