export type CogsRow = {
  supplier: string;
  date: string;
  reference_order_id: string | null;
  supplier_order_id: string | null;
  "total cost": string;
  "est.cost": string;
};

export type CogsSyncSourceRun = {
  source: string;
  status: string;
  pagesProcessed: number;
  totalPages: number | null;
  rowsFetched: number;
  addedCount: number;
  skippedCount: number;
  errorMessage: string | null;
};

export type CogsSyncJob = {
  id: string;
  status: string;
  syncType: string;
  addedCount: number;
  skippedCount: number;
  sourceRuns: CogsSyncSourceRun[];
};

export const headers: Array<{
  key: keyof CogsRow;
  label: string;
  align?: "left" | "right";
}> = [
  { key: "supplier", label: "Supplier", align: "left" },
  { key: "date", label: "Date", align: "left" },
  { key: "reference_order_id", label: "Ref Order ID", align: "left" },
  { key: "supplier_order_id", label: "Supplier Order ID", align: "left" },
  { key: "total cost", label: "Total Cost", align: "right" },
  { key: "est.cost", label: "Est. Cost", align: "right" },
];

export const syncMonths = Array.from(
  { length: 12 },
  (_, index) => `2026-${String(index + 1).padStart(2, "0")}`,
);

export function formatCost(val: string): string {
  const num = Number(val.replaceAll(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return val;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
