"use client";
import { syncPhucPrintifyAction } from "@/actions/fl-printify";
import { ProviderSyncCard } from "@/components/dashboard/fl/bo-import/provider-sync-card";
export function PrintifySyncCard() {
  return (
    <ProviderSyncCard
      provider="Printify"
      description="Đồng bộ chi phí, người nhận và item từ Printify vào RAW.COGS của Team Phúc. Mỗi đơn một dòng."
      note="Trường API không cung cấp để trống. Chọn thời gian theo ngày tạo đơn; giữ trạng thái nguồn."
      destinationUrl="https://docs.google.com/spreadsheets/d/1QFRzd6-gZ9zrjUtywnTeQMotvAVL_0nGUqhAvRZ6_BM/edit#gid=58221536"
      sync={syncPhucPrintifyAction}
    />
  );
}
