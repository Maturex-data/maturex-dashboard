"use client";

import { CalculatorIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { INPUT_FIELDS, monthLabel } from "./report-rows";
import type { MonthlyInput } from "./types";

interface EditInputsSheetProps {
  editingMonth: string | null;
  draft: MonthlyInput | null;
  onDraftChange: (draft: MonthlyInput | null) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

export function EditInputsSheet({
  editingMonth,
  draft,
  onDraftChange,
  onClose,
  onSave,
  saving,
}: EditInputsSheetProps) {
  return (
    <Sheet
      open={Boolean(editingMonth)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="border-b border-border/60">
          <SheetTitle className="flex items-center gap-2">
            <CalculatorIcon className="size-4" /> Chi phí thủ công{" "}
            {editingMonth ? monthLabel(editingMonth) : ""}
          </SheetTitle>
          <SheetDescription>
            Các khoản này chưa có nguồn dữ liệu tự động. Nhập bằng USD và lưu
            riêng cho từng tháng.
          </SheetDescription>
        </SheetHeader>
        {draft ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {INPUT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft[field.key]}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      [field.key]: Number(event.target.value),
                    })
                  }
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="pnl-note">Ghi chú</Label>
              <textarea
                id="pnl-note"
                className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={draft.note ?? ""}
                onChange={(event) =>
                  onDraftChange({ ...draft, note: event.target.value })
                }
              />
            </div>
          </div>
        ) : null}
        <SheetFooter className="border-t border-border/60">
          <Button onClick={() => void onSave()} disabled={saving}>
            <SaveIcon />
            {saving ? "Đang lưu…" : "Lưu chi phí tháng"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
