export function safeNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export function formatCurrency(
  val: unknown,
  currency = "$",
  decimals = 2,
): string {
  const num = safeNumber(val);
  const formatted = Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return num < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
}

export function formatNumber(val: unknown): string {
  return safeNumber(val).toLocaleString("en-US");
}

export function formatPercent(val: unknown, decimals = 1): string {
  const num = safeNumber(val);
  return `${num.toFixed(decimals)}%`;
}
