import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FlowaPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (newPage: number) => void;
}

export function FlowaPagination({
  page,
  pageSize,
  total,
  totalPages,
  loading,
  onPageChange,
}: FlowaPaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-muted-foreground text-xs bg-muted/10">
      <span className="font-mono">
        Tổng cộng:{" "}
        <strong className="text-foreground">{total.toLocaleString()}</strong>{" "}
        bản ghi
        {total > 0 ? (
          <span>
            {" "}
            (Hiển thị {(page - 1) * pageSize + 1} -{" "}
            {Math.min(page * pageSize, total)})
          </span>
        ) : null}
      </span>

      <div className="flex items-center gap-2">
        <Button
          aria-label="Previous page"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          size="sm"
          className="h-7 px-2"
          variant="outline"
        >
          <ArrowLeftIcon className="size-3.5" />
        </Button>
        <span className="min-w-16 text-center font-mono text-xs">
          Trang {page} / {Math.max(1, totalPages)}
        </span>
        <Button
          aria-label="Next page"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          size="sm"
          className="h-7 px-2"
          variant="outline"
        >
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
