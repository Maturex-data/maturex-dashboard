export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1_000;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isVietnamMonth(value: string | undefined): value is string {
  return Boolean(value && MONTH_PATTERN.test(value));
}

export function formatVietnamDate(value: Date): string {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function formatVietnamDateTime(value: Date): string {
  const localIso = new Date(value.getTime() + VIETNAM_OFFSET_MS).toISOString();
  return `${localIso.slice(0, -1)}+07:00`;
}

export function formatVietnamMonth(value: Date): string {
  return formatVietnamDate(value).slice(0, 7);
}

export function vietnamMonthRange(month: string): { from: Date; to: Date } {
  if (!isVietnamMonth(month)) throw new Error(`Invalid month: ${month}`);
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 1) - VIETNAM_OFFSET_MS),
    to: new Date(Date.UTC(year, monthNumber, 1) - VIETNAM_OFFSET_MS),
  };
}

export function previousVietnamMonthRange(now = new Date()): {
  from: Date;
  to: Date;
} {
  const currentMonth = formatVietnamMonth(now);
  const current = vietnamMonthRange(currentMonth);
  const previousDate = new Date(current.from.getTime() - 1);
  return {
    from: vietnamMonthRange(formatVietnamMonth(previousDate)).from,
    to: current.from,
  };
}

export function vietnamMonthOptions(now = new Date()): string[] {
  const currentMonth = formatVietnamMonth(now);
  const [year, monthNumber] = currentMonth.split("-").map(Number);
  return Array.from(
    { length: monthNumber },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  ).reverse();
}
