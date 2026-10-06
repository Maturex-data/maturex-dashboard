"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GenericValidationSummary } from "./bo-orders-summary";
export function CogsReview({ summary }: { summary: GenericValidationSummary }) {
  const changes = summary.decisions?.filter((d) => d.kind === "CHANGED") ?? [];
  return (
    <div className="space-y-3 text-sm">
      <p>
        Thêm mới: {summary.newCount ?? 0} · Không đổi:{" "}
        {summary.unchangedCount ?? 0} · Thay đổi: {summary.changedCount ?? 0} ·
        Xung đột: {summary.conflictCount ?? 0} · Chưa map:{" "}
        {summary.unmappedCount ?? 0} · Trùng file: {summary.duplicateCount ?? 0}
      </p>
      {summary.blocked && (
        <p className="text-destructive">
          Preview còn lỗi cần xử lý. Xem chi tiết từng đơn bên dưới trước khi
          ghi Sheet.
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Thay đổi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((d) => (
            <TableRow key={d.key}>
              <TableCell>{d.orderId}</TableCell>
              <TableCell>
                {d.changes.map((c) => (
                  <p key={c.column}>
                    {c.column}: {String(c.before)} → {String(c.after)}
                  </p>
                ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {(summary.validationDetails ?? [])
        .filter(
          (v) =>
            v.status === "CONFLICT_SOURCE_STORE" ||
            v.status === "CONFLICT_MULTIPLE_STORES",
        )
        .map((v) => (
          <p className="text-destructive" key={`${v.orderId}-${v.status}`}>
            {v.orderId}: {v.message}
          </p>
        ))}
      {(summary.decisions ?? [])
        .filter((d) => d.kind === "CONFLICT")
        .map((d, i) => (
          <p className="text-destructive" key={`${d.key}-${i}`}>
            {d.orderId}: {d.message}
          </p>
        ))}
    </div>
  );
}
