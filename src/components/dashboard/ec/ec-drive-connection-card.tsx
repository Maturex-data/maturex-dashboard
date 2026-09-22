import {
  CloudIcon,
  ExternalLinkIcon,
  LinkIcon,
  UnplugIcon,
} from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

export type DriveConnectionInfo = {
  email: string | null;
  rootFolderId: string | null;
  rootFolderName: string;
  connectedAt: Date | string;
};

export function EcDriveConnectionCard({
  connection,
  disconnecting,
  onDisconnect,
}: {
  connection: DriveConnectionInfo | null;
  disconnecting: boolean;
  onDisconnect: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Subtle emerald glow in the top right corner */}
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-emerald-500/10 blur-3xl" />

      <SectionCard
        className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] via-card to-emerald-500/[0.02] hover:shadow-md hover:border-emerald-500/30 transition-all"
        headerClassName="p-5 border-b-0 bg-transparent"
        icon={<CloudIcon className="size-4 stroke-[2.2]" />}
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span>Google Sheets Destination</span>
            {connection ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
              <span className="font-medium text-emerald-600/90 dark:text-emerald-400">
                EcomCreate_TheDeerly_PL_FINAL
              </span>
            </span>
          ) : (
            "Ủy quyền tài khoản Google Drive để tự động ghi đè dữ liệu vào bảng tính kế toán."
          )
        }
        action={
          <div className="flex items-center gap-2.5">
            {connection ? (
              <>
                {connection.rootFolderId ? (
                  <a
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                      className:
                        "h-9 gap-1.5 rounded-xl border-emerald-500/30 bg-background/90 px-3.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 shadow-xs transition-all",
                    })}
                    href="https://docs.google.com/spreadsheets/d/19QrKNM6Tzn433gRo4neKcT3e6UtRcFaJ7Hj8lvtP5g8/edit"
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                    <span>Mở Google Sheet</span>
                  </a>
                ) : null}
                <Button
                  disabled={disconnecting}
                  onClick={onDisconnect}
                  size="sm"
                  variant="ghost"
                  className="h-9 gap-1.5 rounded-xl px-3 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <UnplugIcon
                    className={`size-3.5 ${disconnecting ? "animate-spin" : ""}`}
                  />
                  <span>Ngắt kết nối</span>
                </Button>
              </>
            ) : (
              <Button
                onClick={() => window.location.assign("/api/ec/drive/connect")}
                size="sm"
                className="h-9 gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all"
              >
                <LinkIcon className="size-3.5" />
                <span>Kết nối Google Drive</span>
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
