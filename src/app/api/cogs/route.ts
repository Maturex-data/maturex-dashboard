import { cogsMonthRange, listCogs, syncCogs } from "@/lib/cogs-sync";
import { formatVietnamDate } from "@/lib/date-time";

export const runtime = "nodejs";

function output(row: Awaited<ReturnType<typeof listCogs>>[number]) {
  return {
    id: row.id,
    supplier: row.supplier,
    date: formatVietnamDate(row.date),
    reference_order_id: row.referenceOrderId,
    supplier_order_id: row.supplierOrderId,
    "total cost": row.totalCost.toString(),
    "est.cost": row.estimatedCost.toString(),
  };
}

export async function GET(request: Request): Promise<Response> {
  const month = new URL(request.url).searchParams.get("month") || undefined;
  const rows = await listCogs(month);
  return Response.json({ rows: rows.map(output) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const source = new URL(request.url).searchParams.get("source");
    const month = new URL(request.url).searchParams.get("month") || undefined;
    const selectedSource =
      source === "pgprint"
        ? "PGPrint"
        : source === "printify"
          ? "Printify"
          : source === "luxury-pro"
            ? "Luxury Pro"
            : undefined;
    return Response.json(await syncCogs(selectedSource, cogsMonthRange(month)));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "COGS sync failed." },
      { status: 500 },
    );
  }
}
