"use client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GenericValidationSummary } from "./bo-orders-summary";
export function CogsReview({
  summary,
  approvedKeys,
  onChange,
}: {
  summary: GenericValidationSummary;
  approvedKeys: string[];
  onChange: (keys: string[]) => void;
}) {
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
      <Button
        type="button"
        variant="outline"
        disabled={!changes.length}
        onClick={() =>
          onChange(
            approvedKeys.length === changes.length
              ? []
              : changes.map((d) => d.key),
          )
        }
      >
        Chọn/bỏ toàn bộ cập nhật
      </Button>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Duyệt</TableHead>
            <TableHead>Order ID</TableHead>
            <TableHead>Thay đổi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((d) => (
            <TableRow key={d.key}>
              <TableCell>
                <Button
                  type="button"
                  variant={approvedKeys.includes(d.key) ? "default" : "outline"}
                  aria-label={`Duyệt cập nhật ${d.orderId}`}
                  aria-pressed={approvedKeys.includes(d.key)}
                  onClick={() =>
                    onChange(
                      approvedKeys.includes(d.key)
                        ? approvedKeys.filter((k) => k !== d.key)
                        : [...approvedKeys, d.key],
                    )
                  }
                >
                  {approvedKeys.includes(d.key) ? "Đã chọn" : "Chọn"}
                </Button>
              </TableCell>
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
