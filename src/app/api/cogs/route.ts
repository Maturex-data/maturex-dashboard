import { after } from "next/server";
import {
  cogsHistoryRange,
  cogsMonthRange,
  createCogsSyncJob,
  executeCogsSyncJob,
  getCogsSyncJob,
  listCogs,
  retryCogsSyncJob,
  syncCogs,
} from "@/lib/cogs-sync";
import { formatVietnamDate } from "@/lib/date-time";

export const runtime = "nodejs";
export const maxDuration = 800;

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
  const searchParams = new URL(request.url).searchParams;
  const jobId = searchParams.get("jobId") || undefined;
  if (jobId || searchParams.get("syncStatus") === "latest") {
    const job = await getCogsSyncJob(jobId);
    return Response.json({ job });
  }
  const month = searchParams.get("month") || undefined;
  const rows = await listCogs(month);
  return Response.json({ rows: rows.map(output) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const searchParams = new URL(request.url).searchParams;
    const action = searchParams.get("action");
    const jobId = searchParams.get("jobId");
    if (action === "retry" && jobId) {
      const retried = await retryCogsSyncJob(jobId);
      if (retried) after(() => executeCogsSyncJob(jobId, true));
      return Response.json({ jobId, retried });
    }
    if (searchParams.get("mode") === "history") {
      const job = await createCogsSyncJob(cogsHistoryRange(), "HISTORY");
      if (!job.reused) after(() => executeCogsSyncJob(job.id));
      return Response.json({ jobId: job.id, reused: job.reused });
    }
    const source = searchParams.get("source");
    const month = searchParams.get("month") || undefined;
    const selectedSource =
      source === "pgprint"
        ? "PGPrint"
        : source === "printify"
          ? "Printify"
          : source === "printful"
            ? "Printful"
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
