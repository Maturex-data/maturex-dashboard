export const FLOWA_REPORT_SPREADSHEET_ID =
  process.env.NEXT_PUBLIC_FLOWA_REPORT_SPREADSHEET_ID ||
  "1WwPh11M0ZEphoYkEHPbN4v-UDOEH1clhCY9E9xq0hrc";

export type FlowaDriveRun = {
  id: string;
  shop: string;
  source: string;
  status: string;
  rangeFrom: Date | string;
  rangeTo: Date | string;
  rowCount: number;
  driveFileUrl: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
};

export type DriveConnectionInfo = {
  email: string | null;
  rootFolderId: string | null;
  rootFolderName: string;
  connectedAt: Date | string;
};

export interface ShopOption {
  readonly code: string;
  readonly name: string;
}

export const sources = ["Statement", "COGS"] as const;

export const sourceConfigs: Record<
  string,
  {
    label: string;
    description: string;
    tag: string;
    activeBorder: string;
    activeBg: string;
    badgeBg: string;
    iconColor: string;
  }
> = {
  Statement: {
    label: "Statement",
    description: "Etsy Payment Statements, Fees, Taxes, Net & Marketing",
    tag: "FLOWA_STATEMENT",
    activeBorder: "border-purple-500/50 dark:border-purple-500/60",
    activeBg: "bg-purple-500/[0.06] shadow-purple-500/5",
    badgeBg:
      "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  COGS: {
    label: "COGS",
    description: "Chi phí giá vốn hàng bán Flowa (Fastway, Equarus, etc.)",
    tag: "FLOWA_COGS",
    activeBorder: "border-amber-500/50 dark:border-amber-500/60",
    activeBg: "bg-amber-500/[0.06] shadow-amber-500/5",
    badgeBg:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
};

export function formatVietnamTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  }).format(date);
}
