export function toMonthKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function sortMonthKeys(values: Date[]): string[] {
  return [...new Set(values.map(toMonthKey))].sort((a, b) =>
    b.localeCompare(a),
  );
}
