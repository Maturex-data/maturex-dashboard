export const ETSY_SHOPS = [
  { code: "97DECOR", name: "97Decor" },
  { code: "ARTISANHAND", name: "Artisanhand" },
  { code: "EVERNEST", name: "Evernest" },
  { code: "POCDY", name: "Pocdy" },
  { code: "TIMOND", name: "Timond" },
] as const;

export const SHOPS_MAP: Record<string, string> = {
  "97DECOR": "97DECOR",
  ARTISANHAND: "ARTISANHAND",
  ARTISANSHAND: "ARTISANHAND",
  EVERNEST: "EVERNEST",
  POCDY: "POCDY",
  TIMOND: "TIMOND",
};

export function normalizeShopCode(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function detectShopFromPath(pathOrName: string): string | null {
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
