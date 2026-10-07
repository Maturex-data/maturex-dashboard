"use client";
import { syncFastwayAction } from "@/actions/fl-fastway";
import { ProviderSyncCard } from "@/components/dashboard/fl/bo-import/provider-sync-card";
export function FastwaySyncCard() {
  return (
    <ProviderSyncCard
      provider="Fastway"
      description="Lấy chi phí đơn hàng trực tiếp từ Fastway vào bảng COGS dùng chung."
      note="Mã Fastway → Supplier Order ID. Etsy Order ID và Store chưa xác định để trống."
      destinationUrl="https://docs.google.com/spreadsheets/d/1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do/edit#gid=58221536"
      sync={syncFastwayAction}
    />
  );
}
