"use client";

import {
  ArrowRightIcon,
  CloudIcon,
  ExternalLinkIcon,
  LinkIcon,
  UnplugIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  targetFileName,
}: {
  connection: DriveConnectionInfo | null;
  disconnecting: boolean;
  onDisconnect: () => void;
  targetFileName?: string | null;
}) {
  const router = useRouter();
  const displayName = targetFileName || "EcomCreate_TheDeerly_PL_FINAL";
  const [connecting, setConnecting] = useState(false);
  const [awaitingCallback, setAwaitingCallback] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [callbackTarget, setCallbackTarget] = useState<{
    origin: string;
    path: string;
  } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  async function startConnection(): Promise<void> {
    setConnecting(true);
    setConnectionError(null);
    try {
      const response = await fetch("/api/ec/drive/connect", { method: "POST" });
      const body = (await response.json()) as {
        authorizationUrl?: string;
        callbackOrigin?: string;
        callbackPath?: string;
        error?: string;
      };
      if (
        !response.ok ||
        !body.authorizationUrl ||
        !body.callbackOrigin ||
        !body.callbackPath
      ) {
        throw new Error(
          body.error || "Không thể bắt đầu kết nối Google Drive.",
        );
      }
      window.open(body.authorizationUrl, "maturex-google-drive", "noopener");
      setCallbackTarget({
        origin: body.callbackOrigin,
        path: body.callbackPath,
      });
      setAwaitingCallback(true);
    } catch (error) {
      setConnectionError(
        error instanceof Error
          ? error.message
          : "Không thể bắt đầu kết nối Google Drive.",
      );
    } finally {
      setConnecting(false);
    }
  }

  async function completeConnection(): Promise<void> {
    try {
      const callback = new URL(callbackUrl);
      if (
        callback.origin !== callbackTarget?.origin ||
        callback.pathname !== callbackTarget.path
      ) {
        throw new Error("URL callback không thuộc ứng dụng hiện tại.");
      }
      const response = await fetch("/api/ec/drive/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl: callback.toString() }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          body.error || "Không thể hoàn tất kết nối Google Drive.",
        );
      }
      setAwaitingCallback(false);
      setCallbackUrl("");
      router.refresh();
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "URL callback không hợp lệ.",
      );
    }
  }

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
                {displayName}
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
                disabled={connecting}
                onClick={startConnection}
                size="sm"
                className="h-9 gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all"
              >
                <LinkIcon
                  className={`size-3.5 ${connecting ? "animate-spin" : ""}`}
                />
                <span>
                  {connecting ? "Đang mở Google…" : "Kết nối Google Drive"}
                </span>
              </Button>
            )}
          </div>
        }
      >
        {!connection && awaitingCallback ? (
          <div className="border-t border-emerald-500/15 px-5 pb-5 pt-4">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Input
                aria-label="Google OAuth callback URL"
                onChange={(event) => setCallbackUrl(event.target.value)}
                placeholder="Dán URL callback từ Google"
                value={callbackUrl}
              />
              <Button
                disabled={!callbackUrl}
                onClick={completeConnection}
                size="sm"
                className="h-9 shrink-0 gap-1.5 bg-emerald-600 text-xs font-semibold hover:bg-emerald-700"
              >
                Hoàn tất
                <ArrowRightIcon className="size-3.5" />
              </Button>
            </div>
            {connectionError ? (
              <p className="mt-2 text-xs font-medium text-destructive">
                {connectionError}
              </p>
            ) : null}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
