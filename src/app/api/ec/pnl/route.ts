import { isVietnamMonth, vietnamMonthOptions } from "@/lib/date-time";
import {
  getEcPnlMonth,
  PNL_INPUT_FIELDS,
  type PnlMonthlyInput,
  saveEcPnlMonthlyInput,
} from "@/lib/ec-pnl";

export const runtime = "nodejs";

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return date.toISOString().slice(0, 7);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const availableMonths = vietnamMonthOptions().reverse();
  const latestMonth = availableMonths.at(-1) ?? "2026-01";
  const firstParam = url.searchParams.get("first") ?? undefined;
  const secondParam = url.searchParams.get("second") ?? undefined;
  const first = isVietnamMonth(firstParam)
    ? firstParam
    : previousMonth(latestMonth);
  const second = isVietnamMonth(secondParam) ? secondParam : latestMonth;
  const reports = await Promise.all([
    getEcPnlMonth(first),
    getEcPnlMonth(second),
  ]);

  return Response.json({ months: availableMonths, reports });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const month = typeof body.month === "string" ? body.month : undefined;
    if (!isVietnamMonth(month)) {
      return Response.json({ error: "Tháng không hợp lệ." }, { status: 400 });
    }

    const inputs = {} as PnlMonthlyInput;
    for (const field of PNL_INPUT_FIELDS) {
      const value = Number(body[field]);
      if (!Number.isFinite(value) || value < 0) {
        return Response.json(
          { error: `${field} phải là số không âm.` },
          { status: 400 },
        );
      }
      inputs[field] = value;
    }
    inputs.note =
      typeof body.note === "string" ? body.note.trim() || null : null;

    await saveEcPnlMonthlyInput(month, inputs);
    return Response.json({ report: await getEcPnlMonth(month) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể lưu cấu hình báo cáo.",
      },
      { status: 500 },
    );
  }
}
