import { CalendarIcon, CreditCardIcon, ZapIcon } from "lucide-react";
import { type ColumnDef, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import type { AppCostRecord } from "@/lib/mock-data";

// Generate a stable color based on the app name
const getAvatarColor = (name: string) => {
  const colors = [
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  ];
  return colors[name.length % colors.length];
};

const columns: ColumnDef<AppCostRecord>[] = [
  {
    header: "Ứng dụng & Phân loại",
    headerClassName: "pl-6",
    cellClassName: "pl-6 align-middle",
    accessor: (rec) => {
      // Extract first two letters for the avatar
      const initials = rec.appName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      return (
        <div className="flex items-center gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-sm shadow-sm border border-black/5 dark:border-white/5 ${getAvatarColor(
              rec.appName,
            )}`}
          >
            {initials}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
              {rec.appName}
            </span>
            <Badge
              variant="secondary"
              className="w-fit text-[10px] px-2 py-0 font-medium bg-muted text-muted-foreground shadow-none"
            >
              {rec.category}
            </Badge>
          </div>
        </div>
      );
    },
  },
  {
    header: "Mô tả",
    headerClassName: "hidden md:table-cell",
    cellClassName: "hidden md:table-cell align-middle",
    accessor: (rec) => (
      <p className="text-muted-foreground text-sm line-clamp-2 max-w-[280px] leading-relaxed">
        {rec.description}
      </p>
    ),
  },
  {
    header: "Chu kỳ",
    cellClassName: "align-middle",
    accessor: (rec) => (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-foreground text-sm font-medium">
          {rec.billingCycle === "Monthly" ? (
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ZapIcon className="w-3.5 h-3.5 text-amber-500" />
          )}
          <span>{rec.billingCycle}</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded-md w-fit">
          {rec.billingDate}
        </span>
      </div>
    ),
  },
  {
    header: "Chi phí",
    headerClassName: "text-right",
    cellClassName: "text-right align-middle",
    accessor: (rec) => (
      <div className="flex flex-col items-end gap-1">
        <span className="font-bold text-foreground text-[15px] font-mono tracking-tight">
          ${rec.cost.toFixed(2)}
        </span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
          <CreditCardIcon className="w-3 h-3" />
          Auto-pay
        </span>
      </div>
    ),
  },
  {
    header: "Trạng thái",
    headerClassName: "text-center pr-6",
    cellClassName: "text-center pr-6 align-middle",
    accessor: (rec) => (
      <>
        {rec.status === "Active" ? (
          <div className="mx-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Active
          </div>
        ) : (
          <div className="mx-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-muted bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"></span>
            {rec.status}
          </div>
        )}
      </>
    ),
  },
];

export function FlAppCostTable({ records }: { records: AppCostRecord[] }) {
  return (
    <DataTable
      columns={columns}
      data={records}
      keyExtractor={(rec) => rec.id}
    />
  );
}
