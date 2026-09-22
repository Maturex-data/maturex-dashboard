"use client";

import {
  CloudIcon,
  ExternalLinkIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { EtsyImportCenter } from "@/components/dashboard/fl/etsy-import-center";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  type DriveConnectionInfo,
  FLOWA_REPORT_SPREADSHEET_ID,
  type ShopOption,
} from "./types";

interface FlTargetCardProps {
  connection: DriveConnectionInfo | null;
  targetFileName?: string | null;
  shops: ShopOption[];
  importModalOpen: boolean;
  onImportModalOpenChange: (open: boolean) => void;
  fastwayDialogSlot?: ReactNode;
}

export function FlTargetCard({
  connection,
  targetFileName,
  shops,
  importModalOpen,
  onImportModalOpenChange,
  fastwayDialogSlot,
}: FlTargetCardProps) {
  const displayName = targetFileName || "MatureX - Etsy Statements & COGS";
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${FLOWA_REPORT_SPREADSHEET_ID}/edit`;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-purple-500/10 blur-3xl" />
      <SectionCard
        className="border-purple-500/20 bg-gradient-to-br from-purple-500/[0.04] via-card to-purple-500/[0.02] hover:shadow-md hover:border-purple-500/30 transition-all"
        headerClassName="p-5 border-b-0 bg-transparent"
        icon={
          <CloudIcon className="size-4 stroke-[2.2] text-purple-600 dark:text-purple-400" />
        }
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span>Google Sheets Destination (Flowa)</span>
            {connection ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 shadow-2xs"
              >
                <span className="size-1.5 rounded-full bg-purple-500 animate-pulse" />
                Đã kết nối
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs font-medium">
                Chưa kết nối
              </Badge>
            )}
          </div>
        }
        description={
          connection ? (
            <span className="inline-flex flex-wrap items-center gap-2 mt-0.5">
              <span className="rounded-md bg-background/80 px-2 py-0.5 font-mono font-medium text-foreground border border-border/70 shadow-2xs">
                {connection.email}
              </span>
              <span className="text-muted-foreground/40 font-bold">/</span>
              <span className="font-medium text-purple-600/90 dark:text-purple-400">
                {displayName}
              </span>
            </span>
          ) : (
            "Tài khoản Google Drive được ủy quyền tự động đồng bộ lên bảng tính Flowa."
          )
        }
        action={
          <div className="flex items-center gap-2.5">
            {fastwayDialogSlot}

            <a
              className={buttonVariants({
                size: "sm",
                variant: "outline",
                className:
                  "h-9 gap-1.5 rounded-xl border-purple-500/30 bg-background/90 px-3.5 text-xs font-semibold text-purple-700 hover:bg-purple-500/10 hover:border-purple-500/50 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-200 shadow-xs transition-all",
              })}
              href={spreadsheetUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon className="size-3.5" />
              <span>Mở Google Sheet</span>
            </a>

            {/* Import Etsy Modal */}
            <Dialog
              open={importModalOpen}
              onOpenChange={onImportModalOpenChange}
            >
              <DialogTrigger
                render={
                  <Button
                    size="sm"
                    className="h-9 gap-2 rounded-xl bg-purple-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 active:scale-[0.98] transition-all"
                  >
                    <UploadCloudIcon className="size-3.5" />
                    <span>Import dữ liệu Etsy (Lựa chọn A)</span>
                  </Button>
                }
              />
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                    <SparklesIcon className="size-5 text-purple-500" />
                    Trung tâm Import dữ liệu Etsy vào Database
                  </DialogTitle>
                  <DialogDescription>
                    Tải lên các file báo cáo Etsy (Orders, Order Items,
                    Statements) và COGS (JODOO). Hệ thống sẽ tự động lưu vào
                    Database trước khi đồng bộ.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <EtsyImportCenter shops={shops} />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
    </div>
  );
}
