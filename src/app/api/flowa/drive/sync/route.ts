import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { formatVietnamDate, vietnamMonthRange } from "@/lib/date-time";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { syncFastwayOrdersToCogs } from "@/lib/fastway-sync";
import {
  FLOWA_REPORT_SPREADSHEET_ID,
  type FlowaReportSheet,
  fetchFlowaCogsValues,
  fetchFlowaStatementValues,
  isFlowaReportSheet,
  writeFlowaSheet,
} from "@/lib/fl-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";
import { prisma } from "@/lib/prisma";

function vietnamDayStart(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1_000);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  return date;
}

function parseRange(payload: {
  month?: string;
  fromMonth?: string;
  toMonth?: string;
  fromDate?: string;
  toDate?: string;
  rangeType?: string;
}): { from: Date; to: Date } {
  if (payload.rangeType === "date") {
    if (!payload.fromDate || !payload.toDate)
      throw new Error("Date range is required.");
    const from = vietnamDayStart(payload.fromDate);
    const to = new Date(
      vietnamDayStart(payload.toDate).getTime() + 24 * 60 * 60 * 1_000,
    );
    if (from >= to) throw new Error("Start date must precede end date.");
    return { from, to };
  }
  if (payload.rangeType === "month-range") {
    if (!payload.fromMonth || !payload.toMonth)
      throw new Error("Month range is required.");
    const from = vietnamMonthRange(payload.fromMonth).from;
    const to = vietnamMonthRange(payload.toMonth).to;
    if (from >= to) throw new Error("Start month must precede end month.");
    return { from, to };
  }
  return vietnamMonthRange(
    payload.month || formatVietnamDate(new Date()).slice(0, 7),
  );
}

async function syncFlowaSheet(
  runId: string,
  sheet: FlowaReportSheet,
  from: Date,
  to: Date,
  shopCode: string,
  accessToken: string,
): Promise<void> {
  try {
    if (sheet === "COGS" && process.env.FASTWAY_API_TOKEN) {
      try {
        await syncFastwayOrdersToCogs({ fromDate: from, toDate: to });
      } catch (fastwayErr) {
        console.error("Fastway auto-sync warning:", fastwayErr);
      }
    }

    const values =
      sheet === "Statement"
        ? await fetchFlowaStatementValues(from, to, shopCode)
        : await fetchFlowaCogsValues(from, to, shopCode);

    await writeFlowaSheet(accessToken, sheet, values, from, to);

    await prisma.ecDriveSyncRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        rowCount: values.length,
        driveFileId: FLOWA_REPORT_SPREADSHEET_ID,
        driveFileName: "FLOWA - Etsy Statements & COGS",
        driveFileUrl: `https://docs.google.com/spreadsheets/d/${FLOWA_REPORT_SPREADSHEET_ID}/edit`,
        errorMessage: null,
      },
    });
  } catch (error) {
    await prisma.ecDriveSyncRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Google Sheet sync failed.",
      },
    });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    shop?: string;
    month?: string;
    fromMonth?: string;
    toMonth?: string;
    fromDate?: string;
    toDate?: string;
    rangeType?: string;
    sources?: string[];
  };

  const shop = payload.shop?.trim() || "ALL";
  const sheets = [
    ...new Set(payload.sources?.filter(isFlowaReportSheet) ?? []),
  ] as FlowaReportSheet[];

  if (!sheets.length) {
    return NextResponse.json(
      { error: "At least one report sheet (Statement or COGS) is required." },
      { status: 400 },
    );
  }

  let range: { from: Date; to: Date };
  try {
    range = parseRange(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid date range." },
      { status: 400 },
    );
  }

  const shopLabel = shop === "ALL" ? "Flowa - All Shops" : `Flowa - ${shop}`;

  const runs = await Promise.all(
    sheets.map((source) =>
      prisma.ecDriveSyncRun.create({
        data: {
          shop: shopLabel,
          source: `FLOWA_${source}`,
          rangeFrom: range.from,
          rangeTo: range.to,
          status: "RUNNING",
          requestedBy: user.email,
          startedAt: new Date(),
        },
      }),
    ),
  );

  try {
    const { accessToken } = await getGoogleDriveAccess();
    await Promise.all(
      runs.map((run) => {
        const sheet = run.source.replace("FLOWA_", "") as FlowaReportSheet;
        return syncFlowaSheet(
          run.id,
          sheet,
          range.from,
          range.to,
          shop,
          accessToken,
        );
      }),
    );
  } catch (error) {
    await prisma.ecDriveSyncRun.updateMany({
      where: { id: { in: runs.map((run) => run.id) } },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error
            ? error.message
            : "Google Drive connection error.",
      },
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Google Drive connection error.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    runIds: runs.map((run) => run.id),
  });
}
