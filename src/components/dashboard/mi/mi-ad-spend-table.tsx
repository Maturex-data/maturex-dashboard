import { type ColumnDef, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import type { AdSpendRecord } from "@/lib/mock-data";

// Generate platform styles
const getPlatformStyle = (platform: string) => {
  switch (platform) {
    case "Facebook Ads":
      return {
        initial: "FB",
        color:
          "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
      };
    case "Google Ads":
      return {
        initial: "GG",
        color:
          "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      };
    case "TikTok Ads":
      return {
        initial: "TK",
        color:
          "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-800/50 dark:text-zinc-300 dark:border-zinc-700",
      };
    default:
      return {
        initial: "AD",
        color:
          "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800",
      };
  }
};

const columns: ColumnDef<AdSpendRecord>[] = [
  {
    header: "Nền tảng & Tài khoản",
    headerClassName: "pl-6",
    cellClassName: "pl-6 align-middle",
    accessor: (rec) => {
      const platformStyle = getPlatformStyle(rec.platform);
      return (
        <div className="flex items-center gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-sm shadow-sm border ${platformStyle.color}`}
          >
            {platformStyle.initial}
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
              {rec.accountName}
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="w-fit text-[10px] px-1.5 py-0 font-medium bg-muted text-muted-foreground shadow-none"
              >
                {rec.platform}
              </Badge>
              <span className="text-[11px] font-mono text-muted-foreground">
                {rec.accountId}
              </span>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    header: "Trạng thái",
    cellClassName: "align-middle",
    accessor: (rec) => (
      <>
        {rec.status === "Active" ? (
          <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Đang chạy
          </div>
        ) : rec.status === "Paused" ? (
          <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-muted bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"></span>
            Tạm dừng
          </div>
        ) : (
          <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            Kháng nghị
          </div>
        )}
      </>
    ),
  },
  {
    header: "Chi tiêu (Spend)",
    headerClassName: "text-right",
    cellClassName: "text-right align-middle",
    accessor: (rec) => (
      <span className="font-bold text-foreground text-[16px] font-mono tracking-tight">
        $
        {rec.spend.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    ),
  },
  {
    header: "Hiển thị (Impr.)",
    headerClassName: "text-right",
    cellClassName: "text-right align-middle",
    accessor: (rec) => (
      <span className="text-muted-foreground font-mono font-medium text-sm">
        {rec.impressions.toLocaleString()}
      </span>
    ),
  },
  {
    header: "Click & CPC",
    headerClassName: "text-right pr-6",
    cellClassName: "text-right pr-6 align-middle",
    accessor: (rec) => (
      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold text-foreground font-mono text-sm">
          {rec.clicks.toLocaleString()}{" "}
          <span className="text-xs text-muted-foreground font-sans">
            clicks
          </span>
        </span>
        <span className="text-[11px] text-muted-foreground font-mono">
          CPC: ${rec.cpc.toFixed(2)}
        </span>
      </div>
    ),
  },
];

export function MiAdSpendTable({ records }: { records: AdSpendRecord[] }) {
  return (
    <DataTable
      columns={columns}
      data={records}
      keyExtractor={(rec) => rec.id}
    />
  );
}
