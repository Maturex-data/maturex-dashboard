import type { MicromAdRow } from "./types";

export interface MetaAccountConfig {
  id: string; // e.g. act_1734816417103349
  name: string;
  currency: string;
  timezone: string;
}

export interface FetchMetaInsightsOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  accountIds?: string[];
}

export async function fetchMicromMetaInsights(
  options: FetchMetaInsightsOptions = {},
): Promise<{
  adRows: MicromAdRow[];
  accountConfigs: MetaAccountConfig[];
}> {
  const rawToken = process.env.MICROM_META_ACCESS_TOKEN;
  if (!rawToken) {
    throw new Error("MICROM_META_ACCESS_TOKEN must be configured.");
  }
  const token = rawToken.trim().replace(/^["']|["']$/g, "");

  const rawAccountIds =
    options.accountIds ||
    (
      process.env.MICROM_META_AD_ACCOUNT_IDS ||
      "1204086927598523,1734816417103349"
    ).split(",");

  const startDate = options.startDate || "2026-01-01";
  const endDate = options.endDate || new Date().toISOString().slice(0, 10);

  const accountConfigs: MetaAccountConfig[] = [];
  const adRows: MicromAdRow[] = [];

  for (const rawId of rawAccountIds) {
    const trimmed = rawId.trim();
    if (!trimmed) continue;
    const actId = trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;

    // 1. Fetch account metadata (currency, timezone, name)
    const accRes = await fetch(
      `https://graph.facebook.com/v24.0/${actId}?fields=name,currency,timezone_name,account_status&access_token=${token}`,
    );
    if (!accRes.ok) {
      const errText = await accRes.text();
      const tokenHint = token
        ? `${token.slice(0, 7)}...${token.slice(-4)}`
        : "empty";
      throw new Error(
        `Meta API error for account ${actId} (token: ${tokenHint}): ${errText}`,
      );
    }
    const accData = (await accRes.json()) as {
      name: string;
      currency: string;
      timezone_name: string;
      account_status: number;
    };

    if (accData.currency !== "USD") {
      throw new Error(
        `Meta account ${actId} currency is ${accData.currency}, but contract expects USD.`,
      );
    }

    const config: MetaAccountConfig = {
      id: actId,
      name: accData.name || actId,
      currency: accData.currency,
      timezone: accData.timezone_name,
    };
    accountConfigs.push(config);

    // 2. Fetch daily account-day insights (strictly level=account, time_increment=1)
    let nextUrl: string | null =
      `https://graph.facebook.com/v24.0/${actId}/insights?time_range=${encodeURIComponent(
        JSON.stringify({ since: startDate, until: endDate }),
      )}&time_increment=1&fields=date_start,spend,impressions,clicks,actions&limit=100&access_token=${token}`;

    while (nextUrl) {
      const insRes = await fetch(nextUrl);
      if (insRes.status === 429) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (!insRes.ok) {
        const errText = await insRes.text();
        throw new Error(`Meta insights error for ${actId}: ${errText}`);
      }

      const insData = (await insRes.json()) as {
        data?: Array<{
          date_start: string;
          spend: string;
          impressions: string;
          clicks: string;
          actions?: Array<{ action_type: string; value: string }>;
        }>;
        paging?: { next?: string };
      };

      for (const row of insData.data || []) {
        const date = row.date_start; // YYYY-MM-DD
        const ky = date.slice(0, 7);
        const spendUsd = Number(row.spend || 0);
        const impressions = Number(row.impressions || 0);
        const clicks = Number(row.clicks || 0);
        const purchases = Number(
          row.actions?.find((a) => a.action_type === "purchase")?.value || 0,
        );

        adRows.push({
          account: config.name,
          accountId: actId,
          ngay: date,
          ky,
          spendUsd,
          impressions,
          clicks,
          purchases,
          nguonDong: `Meta Graph API | ${actId} | ${date}`,
          kiemSoat:
            "Theo account + ngày; dữ liệu lịch sử, không cộng campaign lần hai",
        });
      }

      nextUrl = insData.paging?.next || null;
    }
  }

  // Sort rows by date descending
  adRows.sort(
    (a, b) =>
      b.ngay.localeCompare(a.ngay) || a.accountId.localeCompare(b.accountId),
  );

  return { adRows, accountConfigs };
}
