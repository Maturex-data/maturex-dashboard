import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CreditCardIcon,
} from "lucide-react";
import { type ColumnDef, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import type { ShopifyOrder } from "@/lib/mock-data";

// Generate a stable color based on the customer name
const getAvatarColor = (name: string) => {
  const colors = [
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  ];
  return colors[name.length % colors.length];
};

const columns: ColumnDef<ShopifyOrder>[] = [
  {
    header: "Mã đơn & Khách hàng",
    headerClassName: "pl-6",
    cellClassName: "pl-6",
    accessor: (order) => {
      const initials = order.customerName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      return (
        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm shadow-sm border border-black/5 dark:border-white/5 ${getAvatarColor(
              order.customerName,
            )}`}
          >
            {initials}
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground text-sm font-mono group-hover:text-primary transition-colors">
              {order.orderNumber}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {order.customerName}
            </span>
            <span className="text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md w-fit mt-0.5">
              {order.itemsCount} sản phẩm
            </span>
          </div>
        </div>
      );
    },
  },
  {
    header: "Chu trình thời gian",
    headerClassName: "hidden md:table-cell",
    cellClassName: "hidden md:table-cell",
    accessor: (order) => (
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2">
          <ClockIcon className="size-3.5 text-sky-500 shrink-0" />
          <span className="text-muted-foreground w-8">Tạo:</span>
          <strong className="text-foreground font-mono font-medium bg-muted/40 px-1.5 py-0.5 rounded">
            {order.createdAt}
          </strong>
        </div>
        <div className="flex items-center gap-2">
          <ClockIcon className="size-3.5 text-amber-500 shrink-0" />
          <span className="text-muted-foreground w-8">Gửi:</span>
          <strong className="text-foreground font-mono font-medium bg-muted/40 px-1.5 py-0.5 rounded">
            {order.fulfilledAt ?? "Chờ xuất kho"}
          </strong>
        </div>
        <div className="flex items-center gap-2">
          {order.deliveredAt ? (
            <CheckCircle2Icon className="size-3.5 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircleIcon className="size-3.5 text-muted-foreground/60 shrink-0" />
          )}
          <span className="text-muted-foreground w-8">Nhận:</span>
          <strong
            className={`font-mono font-medium px-1.5 py-0.5 rounded ${
              order.deliveredAt
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted/40 text-muted-foreground"
            }`}
          >
            {order.deliveredAt ?? "Đang transit"}
          </strong>
        </div>
      </div>
    ),
  },
  {
    header: "Giá trị đơn",
    headerClassName: "text-right",
    cellClassName: "text-right",
    accessor: (order) => (
      <div className="flex flex-col items-end gap-1.5">
        <span className="font-bold text-foreground text-[15px] font-mono tracking-tight">
          ${order.orderValue.toFixed(2)}
        </span>
        {order.refundStatus === "None" ? (
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 border border-transparent">
            No Refund
          </span>
        ) : order.refundStatus === "Partial" ? (
          <Badge
            variant="destructive"
            className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] px-1.5 py-0 rounded shadow-none"
          >
            Hoàn ${order.refundAmount.toFixed(2)}
          </Badge>
        ) : (
          <Badge
            variant="destructive"
            className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px] px-1.5 py-0 rounded shadow-none"
          >
            Hoàn đủ (${order.refundAmount.toFixed(2)})
          </Badge>
        )}
      </div>
    ),
  },
  {
    header: "Cổng TT & Phí",
    accessor: (order) => (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <CreditCardIcon className="size-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground text-sm">
            {order.gateway}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">
            Phí:{" "}
            <strong className="font-mono text-foreground">
              ${order.gatewayFee.toFixed(2)}
            </strong>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[150px]">
            {order.transactionId}
          </span>
        </div>
      </div>
    ),
  },
  {
    header: "Payout (Thực nhận)",
    headerClassName: "text-right pr-6",
    cellClassName: "text-right pr-6",
    accessor: (order) => (
      <div className="flex flex-col items-end gap-2">
        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[16px] font-mono tracking-tight">
          ${order.netPayout.toFixed(2)}
        </span>
        <div>
          {order.payoutStatus === "Paid" ? (
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Đã Payout {order.payoutDate ? `(${order.payoutDate})` : ""}
            </div>
          ) : order.payoutStatus === "Pending" ? (
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Chờ đối soát
            </div>
          ) : (
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
              Tạm giữ (Escrow)
            </div>
          )}
        </div>
      </div>
    ),
  },
];

export function EcShopifyOrdersTable({ orders }: { orders: ShopifyOrder[] }) {
  return (
    <DataTable
      columns={columns}
      data={orders}
      keyExtractor={(order) => order.id}
    />
  );
}
