import { formatVietnamDate } from "@/lib/date-time";

type Json = Record<string, unknown>;
export interface MerchOneSyncData {
  rows: (string | number)[][];
  ordersFetched: number;
  matched: number;
  unmapped: number;
}
const object = (value: unknown): Json =>
  value && typeof value === "object" ? (value as Json) : {};

async function getJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ data: Json; response: Response }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (response.status === 429 && attempt < 2) {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.min(10, Number(response.headers.get("retry-after")) || 2) * 1000,
        ),
      );
      continue;
    }
    if (!response.ok)
      throw Error(
        `MerchOne/Shopify GET failed (${response.status}, ${new URL(url).hostname}).`,
      );
    return { data: object(await response.json()), response };
  }
  throw Error("API retry exhausted.");
}

export async function fetchMicromMerchOneOrders(
  storedOrders: { name: string; id: string }[] = [],
): Promise<MerchOneSyncData> {
  const user = process.env.MICROM_MERCHONE_API_USER;
  const key = process.env.MICROM_MERCHONE_API_KEY;
  const domain = process.env.MICROM_SHOPIFY_STORE_DOMAIN?.replace(
    /^https?:\/\//,
    "",
  ).replace(/\/$/, "");
  const token = process.env.MICROM_SHOPIFY_ACCESS_TOKEN;
  if (!user || !key || !domain || !token)
    throw Error("Missing Microm MerchOne/Shopify credentials.");
  const auth = {
    Authorization: `Basic ${Buffer.from(`${user}:${key}`).toString("base64")}`,
    Accept: "application/json",
  };
  const orders: Json[] = [];
  let next: string | null = "https://api.merchone.com/api/v1/orders";
  const visited = new Set<string>();
  while (next) {
    if (
      visited.has(next) ||
      visited.size >= 200 ||
      new URL(next).origin !== "https://api.merchone.com"
    )
      throw Error("Invalid MerchOne pagination.");
    visited.add(next);
    const { data } = await getJson(next, auth);
    if (!Array.isArray(data.data))
      throw Error("Invalid MerchOne order collection.");
    orders.push(...data.data.map(object));
    next =
      typeof object(data.links).next === "string"
        ? String(object(data.links).next)
        : null;
  }
  const shopify = new Map<string, string[]>();
  for (const order of storedOrders)
    shopify.set(order.name, [
      ...new Set([...(shopify.get(order.name) ?? []), order.id]),
    ]);
  next = `https://${domain}/admin/api/${process.env.SHOPIFY_API_VERSION || "2026-07"}/orders.json?status=any&limit=250&fields=id,name`;
  visited.clear();
  while (next) {
    if (
      visited.has(next) ||
      visited.size >= 200 ||
      new URL(next).hostname !== domain
    )
      throw Error("Invalid Microm Shopify pagination.");
    visited.add(next);
    const { data, response } = await getJson(next, {
      "X-Shopify-Access-Token": token,
    });
    if (!Array.isArray(data.orders))
      throw Error("Invalid Shopify order collection.");
    for (const raw of data.orders) {
      const order = object(raw);
      const name = String(order.name);
      shopify.set(name, [
        ...new Set([...(shopify.get(name) ?? []), String(order.id)]),
      ]);
    }
    next =
      response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ??
      null;
  }
  const seen = new Set<string>();
  let matched = 0;
  const rows: (string | number)[][] = [];
  for (const entry of orders) {
    const id = String(entry.order_id ?? "");
    if (!/^PPO\d+$/.test(id) || seen.has(id))
      throw Error("Missing/duplicate MerchOne supplier ID.");
    seen.add(id);
    const { data } = await getJson(
      `https://api.merchone.com/api/v1/orders/${encodeURIComponent(id)}`,
      auth,
    );
    const order = object(data.data ?? data);
    if (order.order_id !== id) throw Error("MerchOne detail ID mismatch.");
    const reference = String(order.external_id ?? "");
    const matches = reference ? (shopify.get(reference) ?? []) : [];
    if (reference && matches.length !== 1)
      throw Error(`MerchOne ${id}: Shopify reference is missing or ambiguous.`);
    if (matches.length) matched++;
    const money = (field: string): number => {
      const value = object(order[field]);
      if (
        value.currency !== "EUR" ||
        typeof value.amount !== "number" ||
        !Number.isFinite(value.amount)
      )
        throw Error(`MerchOne ${id}: invalid ${field}/currency.`);
      return value.amount;
    };
    const created = new Date(String(order.created_at));
    if (Number.isNaN(created.getTime()))
      throw Error(`MerchOne ${id}: invalid creation date.`);
    const day = formatVietnamDate(created);
    rows.push([
      id,
      "",
      reference,
      day,
      day.slice(0, 7),
      String(order.status ?? ""),
      "EUR",
      money("sub_total"),
      money("shipping_total"),
      "",
      "",
      `MerchOne API v1 | Order ${id}`,
      [
        matches.length
          ? "Khớp Shopify chính xác"
          : "Chưa có external_id Shopify; không tự ghép",
        "Chi phí EUR; chưa quy đổi USD vì chưa có tỷ giá được duyệt",
        `Shopify ID: ${matches[0] ?? "chưa xác định"}`,
        order.is_test === true ? "Đơn test; chưa ghi nhận chi phí USD" : "",
      ]
        .filter(Boolean)
        .join(" | "),
      money("total_amount"),
      String(entry.country ?? ""),
    ]);
  }
  return {
    rows,
    ordersFetched: orders.length,
    matched,
    unmapped: orders.length - matched,
  };
}
