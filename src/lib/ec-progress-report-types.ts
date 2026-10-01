export const EC_PROGRESS_SHEET_NAMES = [
  "Tiến độ Q4 2026",
  "KPI ngày T10 2026",
] as const;

export type EcProgressSheetName = (typeof EC_PROGRESS_SHEET_NAMES)[number];

export type EcProgressSheetTable = {
  name: EcProgressSheetName;
  rows: string[][];
};

export type EcProgressSheetData = {
  tables: EcProgressSheetTable[];
  lastUpdatedAt: string;
};
