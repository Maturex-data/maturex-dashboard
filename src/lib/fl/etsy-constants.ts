import type { PrismaClient } from "@/generated/prisma/client";

export const ETSY_SHOPS = [
  { code: "EVERNEST", name: "Evernest" },
  { code: "ORIVIA", name: "Orivia" },
  { code: "TIMOND", name: "Timond" },
  { code: "ARTISANHAND", name: "Artisan" },
  { code: "97DECOR", name: "97Decor" },
  { code: "KINDLORA", name: "Kindlora" },
  { code: "EVERMIRTH", name: "Evermirth" },
] as const;

export type EtsyShopCode = (typeof ETSY_SHOPS)[number]["code"];

export const SHOPS_MAP: Record<string, string> = {
  "97DECOR": "97DECOR",
  ARTISAN: "ARTISANHAND",
  ARTISANHAND: "ARTISANHAND",
  ARTISANSHAND: "ARTISANHAND",
  EVERMIRTH: "EVERMIRTH",
  EVERNEST: "EVERNEST",
  KINDLORA: "KINDLORA",
  ORIVIA: "ORIVIA",
  TIMOND: "TIMOND",
};

export function isPocdyPath(pathOrCode: string): boolean {
  if (!pathOrCode) return false;
  const normalized = normalizeShopCode(pathOrCode);
  if (normalized === "POCDY" || normalized.startsWith("POCDY")) return true;
  const parts = pathOrCode.split(/[/\\]/);
  return parts.some((part) => {
    const norm = normalizeShopCode(part);
    return norm === "POCDY" || norm.startsWith("POCDY");
  });
}

export function normalizeShopCode(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function detectShopFromPath(pathOrName: string): string | null {
  if (isPocdyPath(pathOrName)) {
    return null;
  }
  if (isCogsFileName(pathOrName)) {
    return "97DECOR";
  }
  const parts = pathOrName.split(/[/\\]/).reverse();
  for (const part of parts) {
    const norm = normalizeShopCode(part);
    if (SHOPS_MAP[norm]) return SHOPS_MAP[norm];
  }
  return null;
}

export function isCogsFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    lower.includes("ordermanagement") ||
    lower.includes("issueclaim") ||
    lower.includes("issue") ||
    lower.includes("claim") ||
    lower.includes("cogs")
  );
}

let syncExecuted = false;

export async function ensureEcombiusShops(prismaClient: PrismaClient) {
  if (syncExecuted) return;
  try {
    for (const shop of ETSY_SHOPS) {
      await prismaClient.etsyShop.upsert({
        where: { code: shop.code },
        create: { code: shop.code, name: shop.name, active: true },
        update: { name: shop.name, active: true },
      });
    }
    syncExecuted = true;
  } catch (error) {
    console.error("Failed to ensure ECOMBIUS shops in DB:", error);
  }
}
